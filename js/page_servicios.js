import { charts, updateAllChartsTheme } from './charts.js';

// La función 'parsePreviewData' ya no es necesaria, ya que obtenemos todos los datos
// de forma estructurada desde el informe de resumen. El código es más limpio y fiable.

/**
 * Gestiona el modal de detalle de servicios, mostrando primero una lista y luego el detalle.
 * @param {Array} serviciosData - El array con los datos de los periodos de servicio.
 */
function showServicesModal(serviciosData) {
    const modal = document.getElementById('service-detail-modal');
    const title = document.getElementById('service-modal-title');
    const content = document.getElementById('service-modal-content');
    const backBtn = document.getElementById('serviceModalBackBtn');
    const closeBtn = document.getElementById('closeServiceModalBtn');

    if (!modal || !content || !closeBtn || !backBtn) return;

    function showList() {
        title.textContent = 'Selecciona un Servicio';
        backBtn.style.display = 'none';
        serviciosData.sort((a, b) => new Date(b.OpenDate) - new Date(a.OpenDate));
        let listHtml = '<ul id="service-list">';
        serviciosData.forEach((periodo, index) => {
            const openDate = new Date(periodo.OpenDate);
            const formattedDate = openDate.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const localName = periodo.Local ? ` (${periodo.Local})` : '';
            listHtml += `<li data-index="${index}">Jornada Nº ${periodo.Number} (Inicio: ${formattedDate})${localName}</li>`;
        });
        listHtml += '</ul>';
        content.innerHTML = listHtml;
    }

    function showPreview(index) {
        const periodo = serviciosData[index];
        if (!periodo) return;
        title.textContent = `Informe de Jornada Nº ${periodo.Number}`;
        backBtn.style.display = 'block';
        content.innerHTML = `<div class="ticket-preview-wrapper"><div class="ticket-preview"><pre>${periodo.Preview || 'No hay vista previa disponible.'}</pre></div></div>`;
    }

    closeBtn.onclick = () => { modal.style.display = 'none'; };
    backBtn.onclick = showList;
    content.onclick = (e) => {
        const listItem = e.target.closest('li[data-index]');
        if (listItem) {
            const index = listItem.getAttribute('data-index');
            showPreview(parseInt(index, 10));
        }
    };
    showList();
    modal.style.display = 'flex';
}

/**
 * Función principal para actualizar la página de Análisis de Servicios.
 * @param {object} data - Objeto que contiene los datos de servicios y de resumen.
 */
export function updateServiciosPage(data) {
    const placeholder = document.getElementById('servicios-placeholder');
    const content = document.getElementById('servicios-content');
    const kpiContainer = document.getElementById('kpi-servicios-container');
    const skeleton = document.getElementById('servicios-skeleton');

    const serviciosData = data.servicios;
    const resumenData = data.resumen;

    if (!serviciosData || serviciosData.length === 0) {
        placeholder.innerHTML = `<h4>No hay servicios registrados para este periodo.</h4>`;
        placeholder.style.display = 'block';
        content.style.display = 'none';
        return;
    }
    placeholder.style.display = 'none';
    content.style.display = 'block';

    // --- CÁLCULO DE MÉTRICAS ---
    let totalDuration = 0;
    const serviceCount = serviciosData.length;
    serviciosData.forEach(periodo => {
        const open = new Date(periodo.OpenDate);
        const close = new Date(periodo.CloseDate);
        if (close > open) totalDuration += (close - open);
    });
    const avgDurationMinutes = serviceCount > 0 ? (totalDuration / serviceCount / 1000 / 60) : 0;
    const hours = Math.floor(avgDurationMinutes / 60);
    const minutes = Math.round(avgDurationMinutes % 60);
    const avgServiceTime = `${hours}h ${minutes}m`;

    let totalComensales = 0;
    const ventasPorZona = {};
    const datosPorZona = {}; // Para el gasto medio
    const comensalesPorZona = {}; // Para el total de comensales

    if (resumenData && resumenData.length > 0) {
        resumenData.forEach(item => {
            const comensales = parseInt(item.Comensales) || 0;
            const total = parseFloat(item.Total) || 0;
            const zona = item.Centro || 'Desconocida';
            totalComensales += comensales;
            ventasPorZona[zona] = (ventasPorZona[zona] || 0) + total;
            comensalesPorZona[zona] = (comensalesPorZona[zona] || 0) + comensales;
            if (!datosPorZona[zona]) datosPorZona[zona] = { totalSales: 0, totalDiners: 0 };
            datosPorZona[zona].totalSales += total;
            datosPorZona[zona].totalDiners += comensales;
        });
    }
    
    const avgComensales = serviceCount > 0 ? totalComensales / serviceCount : 0;
    
    // --- ACTUALIZACIÓN DE LA INTERFAZ ---
    kpiContainer.innerHTML = `
        <div class="content-block kpi-metric"><div class="title">Tiempo Promedio Servicio</div><div class="value">${avgServiceTime}</div></div>
        <div class="content-block kpi-metric"><div class="title">Total Comensales</div><div class="value">${totalComensales.toLocaleString('es-ES')}</div></div>
        <div class="content-block kpi-metric"><div class="title">Media Comensales X Servicio</div><div class="value">${avgComensales.toFixed(1)}</div></div>
        <div class="content-block kpi-metric">
            <div class="title">Nº de Servicios</div>
            <div class="value">${serviceCount}</div>
            <a href="#" id="ver-servicios-detalle" class="kpi-see-more">Ver detalle...</a>
        </div>
    `;

    const verDetalleBtn = document.getElementById('ver-servicios-detalle');
    if (verDetalleBtn) {
        verDetalleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showServicesModal(serviciosData);
        });
    }

    const handleChartVisibility = (chartName, data, noDataId) => {
        const chart = charts[chartName];
        if (!chart) return;
        const chartContainer = chart.canvas.parentElement;
        const noDataContainer = document.getElementById(noDataId);
        
        const sortedData = Object.entries(data).sort(([,a],[,b]) => b-a);

        if (sortedData.length > 0) {
            if(chartContainer) chartContainer.style.display = 'block';
            if(noDataContainer) noDataContainer.style.display = 'none';
            chart.data.labels = sortedData.map(item => item[0]);
            chart.data.datasets[0].data = sortedData.map(item => item[1]);
            chart.update();
        } else {
            if(chartContainer) chartContainer.style.display = 'none';
            if(noDataContainer) noDataContainer.style.display = 'flex';
        }
    };

    handleChartVisibility('ventasPorZonaChart', ventasPorZona, 'ventasPorZonaNoData');
    
    const avgGastoZona = {};
    for (const zona in datosPorZona) {
        const zData = datosPorZona[zona];
        avgGastoZona[zona] = zData.totalDiners > 0 ? zData.totalSales / zData.totalDiners : 0;
    }
    handleChartVisibility('gastoComensalZonaChart', avgGastoZona, 'gastoComensalZonaNoData');
    
    handleChartVisibility('comensalesPorZonaChart', comensalesPorZona, 'comensalesPorZonaNoData');

    updateAllChartsTheme();

    if (skeleton) skeleton.style.display = 'none';
    if (content) content.style.display = 'flex';
}