import { charts, updateAllChartsTheme } from './charts.js';
import { getComparisonHtml, hexToRgba } from './utils.js';
import { paymentMethodConfig } from './config.js';

/**
 * Configura todos los eventos de clic para la página de resumen.
 */
export function setupResumenInteractivity(state) {
    const resetResumenBtn = document.getElementById('resetResumenChartBtn');
    const compareMethodsBtn = document.getElementById('compareMethodsBtn');
    const modal = document.getElementById('comparison-modal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    
    if (resetResumenBtn) resetResumenBtn.onclick = () => resetResumenChartFilter(state);
    
    if (compareMethodsBtn) {
        compareMethodsBtn.onclick = () => {
            if (state.resumen && state.resumen.main) {
                updatePaymentMethodByHourChart(state.resumen.main, state.resumen.comparison);
                if(modal) modal.style.display = 'flex';
            }
        };
    }

    if (closeModalBtn) closeModalBtn.onclick = () => { if(modal) modal.style.display = 'none'; };

    if (modal) {
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
    }
}

/**
 * Función principal para actualizar toda la página de Resumen General.
 */
export function updateResumenPage(mainData, comparisonData, state) {
    const placeholder = document.getElementById('resumen-placeholder');
    const content = document.getElementById('resumen-content');
    const kpiContainer = document.getElementById('kpi-resumen-container');
    const skeleton = document.getElementById('resumen-skeleton');
    
    const resumenData = mainData;

    if (!resumenData || resumenData.length === 0) {
        placeholder.innerHTML = `<h4>No hay datos de resumen para este periodo.</h4>`;
        placeholder.style.display = 'block';
        content.style.display = 'none';
        return;
    }
    placeholder.style.display = 'none';
    content.style.display = 'block';

    const calcMetrics = (data) => {
        if (!data || data.length === 0) {
            return { total: 0, transactions: 0, customers: 0, avgTicket: 0, avgPerCustomer: 0, localData: {} };
        }
        
        const total = data.reduce((sum, item) => sum + (parseFloat(item.Total) || 0), 0);
        const transactions = data.length;
        const customers = data.reduce((sum, item) => sum + (parseInt(item.Comensales) || 0), 0);
        const avgTicket = transactions > 0 ? total / transactions : 0;
        const avgPerCustomer = customers > 0 ? total / customers : 0;
        
        const localData = data.reduce((acc, item) => {
            const local = item.Local || 'Desconocido';
            acc[local] = (acc[local] || 0) + (parseFloat(item.Total) || 0);
            return acc;
        }, {});

        return { total, transactions, customers, avgTicket, avgPerCustomer, localData };
    };

    const mainMetrics = calcMetrics(resumenData);
    const compMetrics = calcMetrics(comparisonData);

    const localPrincipal = Object.keys(mainMetrics.localData).length > 0
        ? Object.keys(mainMetrics.localData).reduce((a, b) => mainMetrics.localData[a] > mainMetrics.localData[b] ? a : b)
        : 'N/A';
    
    kpiContainer.innerHTML = `
        <div class="content-block kpi-metric"><div class="title">Ventas Totales</div><div class="value">${mainMetrics.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>${getComparisonHtml(mainMetrics.total, compMetrics.total)}</div>
        <div class="content-block kpi-metric"><div class="title">Total Comensales</div><div class="value">${mainMetrics.customers.toLocaleString('es-ES')}</div><div class="sub-value">Gasto Medio: ${mainMetrics.avgPerCustomer.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div></div>
        <div class="content-block kpi-metric"><div class="title">Nº Transacciones</div><div class="value">${mainMetrics.transactions.toLocaleString('es-ES')}</div><div class="sub-value">Ticket Medio: ${mainMetrics.avgTicket.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div></div>
        <div class="content-block kpi-metric"><div class="title">Local Principal</div><div class="value">${localPrincipal}</div></div>
    `;
    
    if(state) {
        state.resumen = {
            main: mainData,
            comparison: comparisonData
        };
    }
    

    // Ocultamos el esqueleto y mostramos el contenido real
    if (skeleton) skeleton.style.display = 'none';
    if (content) content.style.display = 'flex'; // O 'block' según tu diseño
    
    resetResumenChartFilter(state);
    updateChartMetodoPago(mainData);
    
    // Llamamos a la actualización global de temas AL FINAL de la carga de la página
    updateAllChartsTheme();
}

function updateResumenVentasHora(data) {
    if (!charts.ventasHora || !data) return;
    const ventasPorHora = Array(24).fill(0);
    (data || []).forEach(item => {
        try {
            const hora = new Date(item.Fecha.split('/').reverse().join('-') + 'T' + item.Hora).getHours();
            const total = parseFloat(item.Total) || 0;
            ventasPorHora[hora] += total;
        } catch(e) {}
    });
    charts.ventasHora.data.labels = Array.from({ length: 24 }, (_, i) => `${i}h`);
    charts.ventasHora.data.datasets[0].data = ventasPorHora;
    charts.ventasHora.update();
}

function updateChartMetodoPago(data) {
    if (!charts.ventasMetodoPago || !data) return;
    const paymentData = {};
    for(const method in paymentMethodConfig) {
        paymentData[method] = 0;
    }
    (data || []).forEach(item => {
        for(const method in paymentMethodConfig) {
            const key = paymentMethodConfig[method].dataKey;
            if(item[key] && parseFloat(item[key]) > 0) {
                paymentData[method] += parseFloat(item[key]);
            }
        }
    });
    charts.ventasMetodoPago.data.labels = Object.keys(paymentData);
    charts.ventasMetodoPago.data.datasets[0].data = Object.values(paymentData);
    
    // --- LÍNEA ELIMINADA ---
    // updateAllChartsTheme(); // Quitar esta llamada de aquí previene el error.
}

export function applyResumenChartFilter(state, paymentMethod, color) {
    if (!state.resumen || !state.resumen.main) return;
    const dataKey = paymentMethodConfig[paymentMethod]?.dataKey;
    if (!dataKey) return;
    
    const filteredData = state.resumen.main.filter(item => item[dataKey] && parseFloat(item[dataKey]) > 0);
    const ventasFiltradasPorHora = Array(24).fill(0);
    
    filteredData.forEach(item => {
        try {
            const hora = new Date(item.Fecha.split('/').reverse().join('-') + 'T' + item.Hora).getHours();
            ventasFiltradasPorHora[hora] += parseFloat(item[dataKey]) || 0;
        } catch(e) {}
    });
    
    const lineChart = charts.ventasHora;
    if (!lineChart.data.datasets[1]) lineChart.data.datasets[1] = {};
    
    Object.assign(lineChart.data.datasets[1], {
        label: paymentMethod,
        data: ventasFiltradasPorHora,
        borderColor: color,
        backgroundColor: hexToRgba(color, 0.15),
        fill: true,
        tension: 0.4
    });
    lineChart.update();
    
    document.getElementById('ventas-hora-title').textContent = `Ventas por Hora (${paymentMethod})`;
    document.getElementById('resetResumenChartBtn').style.display = 'inline-block';
}

export function resetResumenChartFilter(state) {
    if (!state.resumen || !state.resumen.main || !charts.ventasHora) return;
    if (charts.ventasHora.data.datasets.length > 1) {
        charts.ventasHora.data.datasets.pop();
    }
    updateResumenVentasHora(state.resumen.main);
    
    document.getElementById('ventas-hora-title').textContent = 'Ventas por Hora';
    document.getElementById('resetResumenChartBtn').style.display = 'none';
    updateAllChartsTheme();
}

export function updatePaymentMethodByHourChart(mainData, comparisonData) { 
    if (!charts.paymentMethodByHourChart) return;

    const processData = (data) => {
        const hourlySales = {};
        for (const method in paymentMethodConfig) {
            hourlySales[method] = Array(24).fill(0);
        }
        (data || []).forEach(item => {
            try {
                const hora = new Date(item.Fecha.split('/').reverse().join('-') + 'T' + item.Hora).getHours();
                for (const method in paymentMethodConfig) {
                    const key = paymentMethodConfig[method].dataKey;
                    if (item[key] && parseFloat(item[key]) > 0) {
                        hourlySales[method][hora] += parseFloat(item[key]);
                    }
                }
            } catch(e) {}
        });
        return hourlySales;
    };

    const mainHourly = processData(mainData);
    const compHourly = processData(comparisonData);

    charts.paymentMethodByHourChart.data.labels = Array.from({ length: 24 }, (_, i) => `${i}h`);
    const datasets = [];
   
    Object.keys(paymentMethodConfig).forEach(method => {
        const config = paymentMethodConfig[method];
        datasets.push({
            label: method,
            data: mainHourly[method],
            borderColor: config.color,
            backgroundColor: hexToRgba(config.color, 0.15),
            fill: true,
            tension: 0.4,
        });
        if (document.getElementById('comparisonSelector').value !== 'none' && comparisonData) {
            datasets.push({
                label: `${method} (Anterior)`,
                data: compHourly[method],
                borderColor: hexToRgba(config.color, 0.4),
                borderDash: [5, 5],
                fill: false,
                tension: 0.4,
            });
        }
    });
    charts.paymentMethodByHourChart.data.datasets = datasets;
    charts.paymentMethodByHourChart.update();
}