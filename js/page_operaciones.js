import { charts, updateAllChartsTheme } from './charts.js';
import { getComparisonHtml, parseMermaDetails } from './utils.js';

let processedMermasData = [];
let currentMermaFilter = null;

// --- FUNCIÓN DE AYUDA PARA MOSTRAR GRÁFICO O MENSAJE ---
/**
 * Actualiza un gráfico con nuevos datos o muestra un mensaje si no hay datos.
 * @param {object} chart - La instancia del gráfico de Chart.js.
 * @param {Array} data - El array de datos para el gráfico.
 * @param {string} noDataMessage - El mensaje a mostrar si no hay datos.
 */
function updateChartOrShowPlaceholder(chart, data, noDataMessage) {
    const container = chart.canvas.parentElement;
    let placeholder = container.querySelector('.chart-placeholder');    const content = document.getElementById('resumen-content');


    // Si el div para el mensaje no existe, lo creamos
    if (!placeholder) {
        placeholder = document.createElement('div');
        placeholder.className = 'placeholder chart-placeholder'; // Usamos tu clase 'placeholder'
        container.appendChild(placeholder);
    }

    if (data.length === 0) {
        // Si no hay datos, ocultamos el gráfico y mostramos el mensaje
        chart.canvas.style.display = 'none';
        placeholder.style.display = 'flex';
        placeholder.innerHTML = `<h4>${noDataMessage}</h4>`;
    } else {
        // Si hay datos, mostramos el gráfico y actualizamos la información
        chart.canvas.style.display = 'block';
        placeholder.style.display = 'none';
        chart.data.labels = data.map(item => item[0]);
        chart.data.datasets[0].data = data.map(item => item[1]);
    }
}


export function applyMermaFilter(motivo) {
    currentMermaFilter = motivo;
    document.getElementById('mermas-table-title').textContent = `Top Productos en Merma (Motivo: ${motivo})`;
    document.getElementById('resetMermasFilterBtn').style.display = 'block';
    updateMermasTable();
}

function resetMermaFilter() {
    currentMermaFilter = null;
    document.getElementById('mermas-table-title').textContent = `Top Productos en Merma (Total)`;
    document.getElementById('resetMermasFilterBtn').style.display = 'none';
    updateMermasTable();
}

function updateMermasTable() {
    const productosEnMerma = processedMermasData.reduce((acc, merma) => {
        if (!currentMermaFilter || merma.parsed.motivo === currentMermaFilter) {
            merma.parsed.productos.forEach(p => {
                acc[p.nombre] = (acc[p.nombre] || 0) + p.cantidad;
            });
        }
        return acc;
    }, {});

    const sortedMermasProductos = Object.entries(productosEnMerma).sort(([, a], [, b]) => b - a).slice(0, 5);
    const mermasTable = document.getElementById('mermas-table-container');
    
    let mermasHtml = '<table class="simple-table"><thead><tr><th>Producto</th><th>Cantidad</th></tr></thead><tbody>';
    if (sortedMermasProductos.length === 0) {
        const filterText = currentMermaFilter ? ` para el motivo '${currentMermaFilter}'` : '';
        mermasHtml += `<tr><td colspan="2" style="text-align:center;">Sin mermas${filterText}</td></tr>`;
    } else {
        sortedMermasProductos.forEach(([nombre, cantidad]) => {
            mermasHtml += `<tr><td>${nombre}</td><td>${cantidad.toLocaleString('es-ES')}</td></tr>`;
        });
    }
    mermasHtml += '</tbody></table>';
    
    if (mermasTable) {
        mermasTable.innerHTML = mermasHtml;
    }
}

export function updateOperacionesPage(mainData, comparisonData) {
    const placeholder = document.getElementById('operaciones-placeholder');
    const content = document.getElementById('operaciones-content');
    const kpiContainer = document.getElementById('kpi-operaciones-container');
    const skeleton = document.getElementById('operaciones-skeleton');

    if ((!mainData.cancelaciones || mainData.cancelaciones.length === 0) && (!mainData.mermas || mainData.mermas.length === 0)) {
        placeholder.innerHTML = `<h4>No hay datos de operaciones para este periodo.</h4>`;
        placeholder.style.display = 'flex';
        content.style.display = 'none';
        return;
    }

    processedMermasData = (mainData.mermas || []).map(merma => ({
        ...merma,
        parsed: parseMermaDetails(merma.Details)
    }));
    
    const resetBtn = document.getElementById('resetMermasFilterBtn');
    if(resetBtn) {
        resetBtn.onclick = resetMermaFilter;
    }

    let totalWasteQty = 0;
    const mermasPorMotivo = {};
    const mermasPorUsuario = {};

    processedMermasData.forEach(merma => {
        const { UserName, parsed } = merma;
        const totalQtyInEvent = parsed.productos.reduce((sum, p) => sum + p.cantidad, 0);
        totalWasteQty += totalQtyInEvent;
        mermasPorMotivo[parsed.motivo] = (mermasPorMotivo[parsed.motivo] || 0) + totalQtyInEvent;
        mermasPorUsuario[UserName] = (mermasPorUsuario[UserName] || 0) + totalQtyInEvent;
    });

    let compWasteQty = 0;
    if (comparisonData && comparisonData.mermas) {
        comparisonData.mermas.forEach(merma => {
            const parsed = parseMermaDetails(merma.Details);
            compWasteQty += parsed.productos.reduce((sum, p) => sum + p.cantidad, 0);
        });
    }

    const mainCancellations = mainData.cancelaciones?.length || 0;
    const compCancellations = comparisonData?.cancelaciones?.length || 0;
    const motivoPrincipal = Object.keys(mermasPorMotivo).length > 0 ? Object.keys(mermasPorMotivo).reduce((a, b) => mermasPorMotivo[a] > mermasPorMotivo[b] ? a : b) : 'N/A';

    if (kpiContainer) {
        kpiContainer.innerHTML = `
            <div class="content-block kpi-metric"><div class="title">Total Cancelaciones</div><div class="value">${mainCancellations}</div>${getComparisonHtml(mainCancellations, compCancellations, true)}</div>
            <div class="content-block kpi-metric"><div class="title">Productos en Merma</div><div class="value">${totalWasteQty.toLocaleString('es-ES')}</div>${getComparisonHtml(totalWasteQty, compWasteQty, true)}</div>
            <div class="content-block kpi-metric"><div class="title">Motivo Principal (uds)</div><div class="value">${motivoPrincipal}</div></div>
        `;
    }

    const cancelacionesPorUsuario = (mainData.cancelaciones || []).reduce((acc, item) => {
        acc[item.Nombre] = (acc[item.Nombre] || 0) + 1;
        return acc;
    }, {});
    const sortedCancelaciones = Object.entries(cancelacionesPorUsuario).sort(([, a], [, b]) => b - a);
    
    const sortedMermasUsuario = Object.entries(mermasPorUsuario).sort(([, a], [, b]) => b - a);
    const sortedMermasMotivo = Object.entries(mermasPorMotivo).sort(([, a], [, b]) => b - a);
    
    // --- CAMBIO AQUÍ: Usamos la nueva función de ayuda para cada gráfico ---
    updateChartOrShowPlaceholder(charts.cancelacionesUsuario, sortedCancelaciones, "Sin cancelaciones");
    updateChartOrShowPlaceholder(charts.mermasUsuarioChart, sortedMermasUsuario, "Sin mermas por usuario");
    updateChartOrShowPlaceholder(charts.mermasMotivo, sortedMermasMotivo, "Sin mermas por motivo");

    const cancelacionesTable = document.getElementById('cancelaciones-table-container');
    if (cancelacionesTable) {
        let cancelacionesHtml = '<table class="simple-table"><thead><tr><th>Hora</th><th>Local</th><th>Usuario</th></tr></thead><tbody>';
        if (!mainData.cancelaciones || mainData.cancelaciones.length === 0) {
            cancelacionesHtml += '<tr><td colspan="3" style="text-align:center;">Sin cancelaciones</td></tr>';
        } else {
            mainData.cancelaciones.slice(0, 5).forEach(c => {
                cancelacionesHtml += `<tr><td>${c.Hora}</td><td>${c.Local}</td><td>${c.Nombre}</td></tr>`;
            });
        }
        cancelacionesHtml += '</tbody></table>';
        cancelacionesTable.innerHTML = cancelacionesHtml;
    }
    
    if(charts.mermasMotivo && charts.mermasMotivo.options){
        charts.mermasMotivo.options.onClick = (evt, elements) => {
            if(elements.length > 0){
                const categoryName = charts.mermasMotivo.data.labels[elements[0].index];
                applyMermaFilter(categoryName);
            }
        }
    }

    resetMermaFilter();
    updateAllChartsTheme();
    
    placeholder.style.display = 'none';
    content.style.display = 'flex';


    if (skeleton) skeleton.style.display = 'none';
    if (content) content.style.display = 'flex';
}