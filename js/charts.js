import { hexToRgba } from './utils.js';
import { analysisChartPalettes, paymentMethodConfig } from './config.js';
import { applyResumenChartFilter } from './page_resumen.js';
import { applyMermaFilter } from './page_operaciones.js';

export const charts = {
    // Resumen
    ventasHora: null,
    ventasMetodoPago: null,
    paymentMethodByHourChart: null,
    // Ventas
    ventasCategoria: null,
    ventasUsuario: null,
    // Rentabilidad (Nuevo)
    costoVentaCategoriaChart: null,
    // Operaciones
    cancelacionesUsuario: null,
    mermasUsuarioChart: null,
    mermasMotivo: null,
    // Servicios (Nuevos)
    ventasPorZonaChart: null,
    gastoComensalZonaChart: null,
    comensalesPorZonaChart: null
};

/**
 * Crea e inicializa todos los gráficos del dashboard al cargar la página.
 */
export function createAllCharts(state) {
    const commonOptions = {
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
            legend: { display: true, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
            tooltip: {
                enabled: true, mode: 'index', intersect: false,
                backgroundColor: 'var(--surface-color)', titleColor: 'var(--text-primary)',
                bodyColor: 'var(--text-secondary)', borderColor: 'var(--border-color)',
                borderWidth: 1, padding: 10,
            }
        },
        scales: {
            y: { ticks: { color: 'var(--text-secondary)', beginAtZero: true }, grid: { color: 'var(--border-color)' } },
            x: { ticks: { color: 'var(--text-secondary)' }, grid: { display: false } }
        }
    };
    
    // --- GRÁFICOS DE RESUMEN ---
    if (document.getElementById('ventasHoraChart')) {
        charts.ventasHora = new Chart(document.getElementById('ventasHoraChart'), { 
            type: 'line', 
            data: { datasets: [{ label: 'Total', tension: 0.4, fill: true }, { label: 'Filtro', tension: 0.4, fill: true }] },
            options: { ...commonOptions, plugins: {...commonOptions.plugins, legend: { display: false }} } 
        });
    }
    
    if (document.getElementById('ventasMetodoPagoChart')) {
        charts.ventasMetodoPago = new Chart(document.getElementById('ventasMetodoPagoChart'), { 
            type: 'doughnut', 
            data: { datasets: [{ borderWidth: 0 }] }, 
            options: { ...commonOptions, scales: {},
                plugins: { ...commonOptions.plugins, tooltip: { callbacks: { label: (context) => `${context.label}: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(context.raw)}` } } },
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const i = elements[0].index;
                        const label = charts.ventasMetodoPago.data.labels[i];
                        const color = charts.ventasMetodoPago.data.datasets[0].backgroundColor[i];
                        applyResumenChartFilter(state, label, color);
                    }
                }
            } 
        });
    }
    
    if (document.getElementById('paymentMethodByHourChart')) {
        charts.paymentMethodByHourChart = new Chart(document.getElementById('paymentMethodByHourChart'), { type: 'line', data: { datasets: []}, options: { ...commonOptions, plugins: { ...commonOptions.plugins, tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(context.raw)}` } } } } });
    }
    
    // --- GRÁFICOS DE VENTAS Y RENTABILIDAD ---
    const barChartOptions = (unit, isCurrency = false) => ({ ...commonOptions, indexAxis: 'y', plugins: { ...commonOptions.plugins, legend: { display: true }, tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${isCurrency ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(context.raw) : context.raw.toLocaleString('es-ES')} ${unit}` } } } });
    const comparisonDataset = { label: 'Anterior', barThickness: 15, borderRadius: 4, data: [] };
    const mainDataset = { label: 'Actual', barThickness: 15, borderRadius: 4, data: [] };
    
    if (document.getElementById('ventasCategoriaChart')) {
        charts.ventasCategoria = new Chart(document.getElementById('ventasCategoriaChart'), { type: 'bar', data: { datasets: [{...mainDataset},{...comparisonDataset}] }, options: barChartOptions('', true) });
    }
    
    if (document.getElementById('ventasUsuarioChart')) {
        charts.ventasUsuario = new Chart(document.getElementById('ventasUsuarioChart'), { type: 'bar', data: { datasets: [{...mainDataset},{...comparisonDataset}] }, options: barChartOptions('', true) });
    }

    if (document.getElementById('costoVentaCategoriaChart')) {
        charts.costoVentaCategoriaChart = new Chart(document.getElementById('costoVentaCategoriaChart'), { 
            type: 'bar', 
            data: { 
                labels: [], 
                datasets: [
                    { label: 'Ventas (€)', data: [] }, 
                    { label: 'Costo (€)', data: [] }
                ] 
            }, 
            options: { ...barChartOptions('', true), scales: { x: { stacked: false }, y: { stacked: false } } } 
        });
    }

    // --- GRÁFICOS DE OPERACIONES ---
    const opsTooltips = (unit) => ({ ...commonOptions.plugins.tooltip, callbacks: { label: (context) => `${context.raw.toLocaleString('es-ES')} ${unit}` } });
    
    if (document.getElementById('cancelacionesUsuarioChart')) {
        charts.cancelacionesUsuario = new Chart(document.getElementById('cancelacionesUsuarioChart'), { type: 'bar', data: { datasets: [{label: 'Cancelaciones'}] }, options: { ...commonOptions, plugins: { ...commonOptions.plugins, legend: {display: false}, tooltip: opsTooltips('eventos') } } });
    }

    if (document.getElementById('mermasUsuarioChart')) {
        charts.mermasUsuarioChart = new Chart(document.getElementById('mermasUsuarioChart'), { type: 'bar', data: { datasets: [{label: 'Mermas'}] }, options: { ...commonOptions, plugins: { ...commonOptions.plugins, legend: {display: false}, tooltip: opsTooltips('uds.') } } });
    }

    if (document.getElementById('mermasMotivoChart')) {
        charts.mermasMotivo = new Chart(document.getElementById('mermasMotivoChart'), { 
            type: 'bar', 
            data: { datasets: [{ borderWidth: 1 }] }, 
            options: { ...commonOptions, indexAxis: 'y', scales: {x:{ticks:{display:false}}, y:{grid:{display:false}}}, plugins: { ...commonOptions.plugins, legend: { display: false }, tooltip: opsTooltips('uds.') },
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const i = elements[0].index;
                        const label = charts.mermasMotivo.data.labels[i];
                        applyMermaFilter(label);
                    }
                }
            } 
        });
    }

    // --- GRÁFICOS DE SERVICIOS ---
    if (document.getElementById('ventasPorZonaChart')) {
        charts.ventasPorZonaChart = new Chart(document.getElementById('ventasPorZonaChart'), {
            type: 'bar',
            data: { datasets: [{ label: 'Ventas (€)' }] },
            options: { ...barChartOptions('', true), plugins: { ...barChartOptions('', true).plugins, legend: { display: false } } }
        });
    }

    if (document.getElementById('gastoComensalZonaChart')) {
        charts.gastoComensalZonaChart = new Chart(document.getElementById('gastoComensalZonaChart'), {
            type: 'bar',
            data: { datasets: [{ label: 'Gasto Medio (€)' }] },
            options: { ...barChartOptions('', true), plugins: { ...barChartOptions('', true).plugins, legend: { display: false } } }
        });
    }
    
    if (document.getElementById('comensalesPorZonaChart')) {
        charts.comensalesPorZonaChart = new Chart(document.getElementById('comensalesPorZonaChart'), {
            type: 'bar',
            data: { datasets: [{ label: 'Total Comensales' }] },
            options: { ...barChartOptions('comensales'), plugins: { ...barChartOptions('comensales').plugins, legend: { display: false } } }
        });
    }
}

/**
 * Actualiza los colores de todos los gráficos para que coincidan con el tema (claro/oscuro).
 */
export function updateAllChartsTheme() {
    const isLight = !document.body.classList.contains('dark-theme');
    const palette = analysisChartPalettes[isLight ? 'light' : 'dark'];
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
    const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim();
    const surfaceColor = getComputedStyle(document.documentElement).getPropertyValue('--surface-color').trim();
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim();
    
    for (const chartKey in charts) {
        const chart = charts[chartKey];
        if (!chart) continue;
        const chartOptions = chart.options;
        
        if (chartOptions.plugins?.legend) chartOptions.plugins.legend.labels.color = textColor;
        if (chartOptions.plugins?.tooltip) {
            chartOptions.plugins.tooltip.backgroundColor = surfaceColor;
            chartOptions.plugins.tooltip.titleColor = primaryColor;
            chartOptions.plugins.tooltip.bodyColor = textColor;
            chartOptions.plugins.tooltip.borderColor = borderColor;
        }
        if (chartOptions.scales) {
            Object.values(chartOptions.scales).forEach(axis => {
                if(axis) {
                    if (axis.ticks) axis.ticks.color = textColor;
                    if (axis.grid) axis.grid.color = borderColor;
                }
            });
        }
    }
    
    if (charts.ventasHora?.data.datasets[0]) {
        if (!charts.ventasHora.data.datasets[1] || charts.ventasHora.data.datasets[1].data.length === 0) {
            charts.ventasHora.data.datasets[0].borderColor = accentColor;
            charts.ventasHora.data.datasets[0].backgroundColor = hexToRgba(accentColor, 0.15);
        }
    }
    
    if(charts.ventasMetodoPago?.data.datasets[0]) {
        charts.ventasMetodoPago.data.datasets[0].backgroundColor = Object.values(paymentMethodConfig).map(c => c.color);
    }
    
    // Asignación de colores de la paleta
    if(charts.ventasCategoria?.data.datasets[0]) {
        charts.ventasCategoria.data.datasets[0].backgroundColor = palette[1];
        if(charts.ventasCategoria.data.datasets[1]) charts.ventasCategoria.data.datasets[1].backgroundColor = hexToRgba(palette[1], 0.35);
    }
    if(charts.ventasUsuario?.data.datasets[0]) {
        charts.ventasUsuario.data.datasets[0].backgroundColor = palette[2];
        if(charts.ventasUsuario.data.datasets[1]) charts.ventasUsuario.data.datasets[1].backgroundColor = hexToRgba(palette[2], 0.35);
    }
    if(charts.costoVentaCategoriaChart?.data.datasets[0]) {
        charts.costoVentaCategoriaChart.data.datasets[0].backgroundColor = palette[0];
        if(charts.costoVentaCategoriaChart.data.datasets[1]) charts.costoVentaCategoriaChart.data.datasets[1].backgroundColor = hexToRgba(palette[0], 0.35);
    }
    if(charts.cancelacionesUsuario?.data.datasets[0]) {
        charts.cancelacionesUsuario.data.datasets[0].backgroundColor = palette[3];
    }
    if(charts.mermasUsuarioChart?.data.datasets[0]) {
        charts.mermasUsuarioChart.data.datasets[0].backgroundColor = palette[4];
    }
    if(charts.mermasMotivo?.data.datasets[0]) {
        charts.mermasMotivo.data.datasets[0].backgroundColor = palette;
    }
    if(charts.ventasPorZonaChart?.data.datasets[0]) {
        charts.ventasPorZonaChart.data.datasets[0].backgroundColor = palette[5] || palette[0];
    }
    if(charts.gastoComensalZonaChart?.data.datasets[0]) {
        charts.gastoComensalZonaChart.data.datasets[0].backgroundColor = palette[6] || palette[1];
    }
    if(charts.comensalesPorZonaChart?.data.datasets[0]) {
        charts.comensalesPorZonaChart.data.datasets[0].backgroundColor = palette[7] || palette[2];
    }
    
    // Actualizamos todos los gráficos al final para aplicar los cambios de tema
    for (const chartKey in charts) { 
        if(charts[chartKey]) charts[chartKey].update('none'); 
    }
}