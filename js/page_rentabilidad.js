import { charts, updateAllChartsTheme } from './charts.js';
import { getComparisonHtml } from './utils.js';

const RENTABILIDAD_UMBRALES = {
    bueno: 0.75, // Margen > 75%
    regular: 0.70  // Margen > 70%
};

// --- FUNCIÓN DE AYUDA (similar a la que usamos en operaciones) ---
function updateChartOrShowPlaceholder(chart, data, noDataMessage) {
    const container = chart.canvas.parentElement;
    let placeholder = container.querySelector('.chart-placeholder');
    if (!placeholder) {
        placeholder = document.createElement('div');
        placeholder.className = 'placeholder chart-placeholder';
        container.insertBefore(placeholder, chart.canvas);
    }

    if (data.length === 0) {
        chart.canvas.style.display = 'none';
        placeholder.style.display = 'flex';
        placeholder.innerHTML = `<h4>${noDataMessage}</h4>`;
    } else {
        chart.canvas.style.display = 'block';
        placeholder.style.display = 'none';
        chart.data.labels = data.map(c => c[0]);
        chart.data.datasets[0].data = data.map(([,v]) => v.sales);
        chart.data.datasets[1].data = data.map(([,v]) => v.cost);
    }
}

export function updateRentabilidadPage(mainData, comparisonData) {
    const skeleton = document.getElementById('rentabilidad-skeleton');
    const content = document.getElementById('rentabilidad-content');
    const kpiContainer = document.getElementById('kpi-rentabilidad-container');

    const tieneCostos = mainData && mainData.some(item => (parseFloat(item.ProductCostPrice) || 0) > 0);
    if (!tieneCostos) {
        // Mantenemos el placeholder principal si no hay datos de costos
        const placeholder = document.getElementById('rentabilidad-placeholder');
        if (placeholder) {
             placeholder.innerHTML = `<div class="content-block placeholder"><i class="bi bi-exclamation-triangle-fill" style="font-size: 3rem; margin-bottom: 1rem;"></i><h4>Datos de costos no disponibles.</h4><p style="max-width: 400px; margin: 0 auto;">Asegúrate de que el campo 'ProductCostPrice' esté poblado en tu API para ver esta sección.</p></div>`;
             placeholder.style.display = 'flex';
        }
        if (skeleton) skeleton.style.display = 'none';
        if (content) content.style.display = 'none';
        return;
    }
    
    const processCostData = (data) => {
        if (!data || data.length === 0) return null;
        
        const metrics = {
            totalSales: 0, totalCost: 0, byCategory: {}, byProduct: {}
        };
        const ticketsProcessed = new Set();

        data.forEach(item => {
            const ticketNum = item.Numero;
            const sign = (ticketNum || '').toUpperCase().includes('D') ? -1 : 1;
            const saleValue = parseFloat(item.GrossAmount) || 0; 
            const costValue = (parseFloat(item.ProductCostPrice) || 0) * (parseFloat(item.Quantity) || 0);
            const categoria = (item.ListaCategorias || 'Desconocido').split(',')[0].trim();
            const productName = item.SaleFormatName;

            if (sign > 0 && !ticketsProcessed.has(ticketNum)) {
                metrics.totalSales += saleValue;
                ticketsProcessed.add(ticketNum);
            }
            if (costValue > 0) {
                metrics.totalCost += costValue * sign;
            }
            
            if (!metrics.byCategory[categoria]) metrics.byCategory[categoria] = { sales: 0, cost: 0 };
            if (sign > 0) metrics.byCategory[categoria].sales += saleValue;
            if (costValue > 0) metrics.byCategory[categoria].cost += costValue;
            
            if (!metrics.byProduct[productName]) metrics.byProduct[productName] = { sales: 0, cost: 0 };
            if (sign > 0) metrics.byProduct[productName].sales += saleValue;
            if (costValue > 0) metrics.byProduct[productName].cost += costValue;
        });

        metrics.grossMargin = metrics.totalSales - metrics.totalCost;
        metrics.marginPercentage = metrics.totalSales > 0 ? metrics.grossMargin / metrics.totalSales : 0;
        
        return metrics;
    };
    
    const mainMetrics = processCostData(mainData);
    const compMetrics = processCostData(comparisonData);

    let marginClass = 'bad';
    if (mainMetrics.marginPercentage >= RENTABILIDAD_UMBRALES.bueno) marginClass = 'good';
    else if (mainMetrics.marginPercentage >= RENTABILIDAD_UMBRALES.regular) marginClass = 'regular';
    
    if (kpiContainer) {
        kpiContainer.innerHTML = `
            <div class="content-block kpi-metric"><div class="title">Ventas Netas</div><div class="value">${mainMetrics.totalSales.toLocaleString('es-ES', {style:'currency', currency:'EUR'})}</div>${getComparisonHtml(mainMetrics.totalSales, compMetrics?.totalSales)}</div>
            <div class="content-block kpi-metric"><div class="title">Costo Mercancía (COGS)</div><div class="value">${mainMetrics.totalCost.toLocaleString('es-ES', {style:'currency', currency:'EUR'})}</div>${getComparisonHtml(mainMetrics.totalCost, compMetrics?.totalCost, true)}</div>
            <div class="content-block kpi-metric"><div class="title">Margen Bruto (€)</div><div class="value">${mainMetrics.grossMargin.toLocaleString('es-ES', {style:'currency', currency:'EUR'})}</div>${getComparisonHtml(mainMetrics.grossMargin, compMetrics?.grossMargin)}</div>
            <div class="content-block kpi-metric"><div class="title">% Margen Bruto</div><div class="value"><span class="traffic-light ${marginClass}">${(mainMetrics.marginPercentage * 100).toFixed(1)}%</span></div></div>
        `;
    }
    
    const sortedCategories = Object.entries(mainMetrics.byCategory).filter(([,v])=> v.sales > 0).sort(([,a],[,b]) => b.sales - a.sales).slice(0, 10);
    // --- CAMBIO AQUÍ: Usamos la función de ayuda para el gráfico ---
    updateChartOrShowPlaceholder(charts.costoVentaCategoriaChart, sortedCategories, "Sin datos de categorías");
    
    const productosConMargen = Object.entries(mainMetrics.byProduct).map(([name, data]) => {
        const margin = data.sales > 0 ? (data.sales - data.cost) / data.sales : 0;
        return { name, margin };
    }).filter(p => p.margin > 0 && p.margin < 1);

    const sortedProductos = productosConMargen.sort((a,b) => a.margin - b.margin).slice(0,5);
    let tableHtml = '<table class="simple-table"><thead><tr><th>Producto</th><th>% Margen</th></tr></thead><tbody>';

    // --- CAMBIO AQUÍ: Comprobamos si hay productos para la tabla ---
    if (sortedProductos.length === 0) {
        tableHtml += '<tr><td colspan="2" style="text-align: center;">Sin productos para mostrar</td></tr>';
    } else {
        sortedProductos.forEach(p => {
            tableHtml += `<tr><td>${p.name}</td><td>${(p.margin * 100).toFixed(1)}%</td></tr>`;
        });
    }
    tableHtml += '</tbody></table>';
    
    const productosContainer = document.getElementById('productos-rentabilidad-container');
    if (productosContainer) {
        productosContainer.innerHTML = tableHtml;
    }

    if (skeleton) skeleton.style.display = 'none';
    if (content) content.style.display = 'flex';

    updateAllChartsTheme();
}