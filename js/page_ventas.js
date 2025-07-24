import { charts } from './charts.js';
import { getComparisonHtml } from './utils.js';

let fullSalesData = [];
let fullComparisonData = [];

function showCategoryDetails(categoryName) {
    const modal = document.getElementById('category-detail-modal');
    const modalTitle = document.getElementById('category-modal-title');
    const modalContent = document.getElementById('category-modal-content');

    if (!modal || !modalTitle || !modalContent) return;

    const comparisonSelector = document.getElementById('comparisonSelector');
    const isComparisonActive = fullComparisonData && fullComparisonData.length > 0 && comparisonSelector.value !== 'none';

    const processData = (data) => {
        if (!data) return {};
        const productsInCategory = data.filter(item => (item.ListaCategorias || 'Desconocido').split(',')[0].trim() === categoryName);
        return productsInCategory.reduce((acc, item) => {
            const productName = item.SaleFormatName;
            const sign = (item.Numero || '').toUpperCase().includes('D') ? -1 : 1;
            const quantity = (parseFloat(item.Quantity) || 0) * sign;
            acc[productName] = (acc[productName] || 0) + quantity;
            return acc;
        }, {});
    };

    const currentPeriodUnits = processData(fullSalesData);
    const previousPeriodUnits = isComparisonActive ? processData(fullComparisonData) : {};
    const allProductNames = new Set([...Object.keys(currentPeriodUnits), ...Object.keys(previousPeriodUnits)]);
    const combinedData = Array.from(allProductNames).map(name => ({
        name: name,
        current: currentPeriodUnits[name] || 0,
        previous: previousPeriodUnits[name] || 0,
    })).sort((a, b) => b.current - a.current);

    modalTitle.textContent = `Top Productos en "${categoryName}"`;
    let tableHtml = '<table class="simple-table"><thead><tr><th>Producto</th><th>Unidades (Actual)</th>';
    if (isComparisonActive) tableHtml += '<th>Unidades (Anterior)</th>';
    tableHtml += '</tr></thead><tbody>';

    if (combinedData.length === 0) {
        tableHtml += `<tr><td colspan="${isComparisonActive ? 3 : 2}">No hay productos para esta categoría.</td></tr>`;
    } else {
        combinedData.forEach(product => {
            tableHtml += `<tr><td>${product.name}</td><td>${product.current.toLocaleString('es-ES')}</td>`;
            if (isComparisonActive) {
                let indicator = '';
                if (product.previous !== 0) {
                    if (product.current > product.previous) indicator = '<span class="comparison increase">▲</span>';
                    if (product.current < product.previous) indicator = '<span class="comparison decrease">▼</span>';
                }
                tableHtml += `<td>${product.previous.toLocaleString('es-ES')} ${indicator}</td>`;
            }
            tableHtml += '</tr>';
        });
    }
    tableHtml += '</tbody></table>';
    modalContent.innerHTML = tableHtml;
    modal.style.display = 'flex';
}

function updateTopProducts(data) {
    const container = document.getElementById('top-products-container');
    if (!container) return;

    // --- ¡IMPORTANTE! Revisa y ajusta estas palabras clave ---
    // Añade o quita palabras según las categorías de tu cliente para que la clasificación sea precisa.
    const topProductsConfig = {
        'Comida': {
            title: 'Top Comida',
            keywords: ['PIZZA', 'PASTA', 'CARNE', 'SIDES', 'ENSALADA', 'POSTRE', 'ENTRANTE', 'PAN', 'AGUACATE']
        },
        'Bebidas': {
            title: 'Top Bebidas',
            keywords: ['REFRESCO', 'AGUA', 'CERVEZA', 'CAFE', 'COLA', 'VICHY']
        },
        'Vinos': {
            title: 'Top Vinos',
            keywords: ['VINO', 'TINTO', 'BLANCO', 'ROSADO', 'ESPUMOSO', 'CHARDONNAY', 'CHIVITE']
        }
    };

    let html = '';
    for (const groupName in topProductsConfig) {
        const config = topProductsConfig[groupName];

        const products = (data || []).filter(item => {
                const categories = (item.ListaCategorias || '').toUpperCase();
                return config.keywords.some(keyword => categories.includes(keyword));
            })
            .reduce((acc, item) => {
                const name = item.SaleFormatName;
                const qty = parseFloat(item.Quantity) || 0;
                const sign = (item.Numero || '').toUpperCase().includes('D') ? -1 : 1;
                if(sign > 0) acc[name] = (acc[name] || 0) + qty;
                return acc;
            }, {});

        const sortedProducts = Object.entries(products).sort(([, a], [, b]) => b - a).slice(0, 5);

        html += `<div class="content-block"><h6>${config.title}</h6><ol class="top-products-list">`;
        if (sortedProducts.length > 0) {
            sortedProducts.forEach(([name, qty]) => {
                html += `<li><span>${name}</span><span>${qty.toLocaleString('es-ES')}</span></li>`;
            });
        } else {
            html += `<li class="no-data"><span>Sin datos</span></li>`;
        }
        html += `</ol></div>`;
    }
    container.innerHTML = html;
}

export function updateVentasPage(mainData, comparisonData) {
    fullSalesData = mainData;
    fullComparisonData = comparisonData;

    const placeholder = document.getElementById('ventas-placeholder');
    const content = document.getElementById('ventas-content');

    const categoryModal = document.getElementById('category-detail-modal');
    const closeCategoryBtn = document.getElementById('closeCategoryModalBtn');
    if (categoryModal && closeCategoryBtn) {
        closeCategoryBtn.onclick = () => { categoryModal.style.display = 'none'; };
        categoryModal.onclick = (e) => { if (e.target === categoryModal) categoryModal.style.display = 'none'; };
    }

    if (!mainData || mainData.length === 0) {
        placeholder.innerHTML = `<h4>No hay datos de ventas para este periodo.</h4>`;
        placeholder.style.display = 'block';
        content.style.display = 'none';
        return;
    }
    placeholder.style.display = 'none';
    content.style.display = 'block';

    const processDataInOnePass = (data) => {
        if (!data || data.length === 0) {
            return { kpis: { totalSales: 0, numTickets: 0, uniqueTables: 0, avgCheck: 0 }, byCategory: {}, byUser: {} };
        }
        
        const tickets = {};
        const byCategory = {};
        const byUser = {};

        data.forEach(item => {
            const ticketNum = item.Numero;
            const sign = (ticketNum || '').toUpperCase().includes('D') ? -1 : 1;
            const grossAmount = parseFloat(item.GrossAmount) || 0;
            const usuario = item.Usuario;
            const categoria = (item.ListaCategorias || 'Desconocido').split(',')[0].trim();

            if (!tickets[ticketNum]) {
                tickets[ticketNum] = { grossAmount: grossAmount * sign, mesa: item.Mesa };
            }
            
            if (!tickets[ticketNum].categoryProcessed) {
                byCategory[categoria] = (byCategory[categoria] || 0) + (grossAmount * sign);
                tickets[ticketNum].categoryProcessed = true;
            }
            
            if (!byUser[usuario]) {
                byUser[usuario] = { tickets: new Set(), sales: 0, firstLineOfTickets: new Set() };
            }
            byUser[usuario].tickets.add(ticketNum);
            if (!byUser[usuario].firstLineOfTickets.has(ticketNum)) {
                byUser[usuario].sales += (grossAmount * sign);
                byUser[usuario].firstLineOfTickets.add(ticketNum);
            }
        });

        const ticketArray = Object.values(tickets);
        const totalSales = ticketArray.reduce((sum, t) => sum + t.grossAmount, 0);
        const numTickets = ticketArray.length;
        const uniqueTables = new Set(ticketArray.map(t => t.mesa)).size;
        const kpis = { totalSales, numTickets, uniqueTables, avgCheck: uniqueTables > 0 ? totalSales / uniqueTables : 0 };

        return { kpis, byCategory, byUser };
    };

    const mainProcessed = processDataInOnePass(mainData);
    const compProcessed = processDataInOnePass(comparisonData);

    document.getElementById('kpi-ventas-container').innerHTML = `
        <div class="content-block kpi-metric"><div class="title">Ventas Netas</div><div class="value">${mainProcessed.kpis.totalSales.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>${getComparisonHtml(mainProcessed.kpis.totalSales, compProcessed.kpis.totalSales)}</div>
        <div class="content-block kpi-metric"><div class="title">Nº de Tickets</div><div class="value">${mainProcessed.kpis.numTickets}</div>${getComparisonHtml(mainProcessed.kpis.numTickets, compProcessed.kpis.numTickets)}</div>
        <div class="content-block kpi-metric"><div class="title">Cheque Promedio / Mesa</div><div class="value">${mainProcessed.kpis.avgCheck.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>${getComparisonHtml(mainProcessed.kpis.avgCheck, compProcessed.kpis.avgCheck)}</div>
        <div class="content-block kpi-metric"><div class="title">Mesas Atendidas</div><div class="value">${mainProcessed.kpis.uniqueTables}</div>${getComparisonHtml(mainProcessed.kpis.uniqueTables, compProcessed.kpis.uniqueTables)}</div>
    `;

    const isComparisonActive = comparisonData && comparisonData.length > 0;
    
    const updateChart = (chart, mainAgg, compAgg) => {
        const sortedEntries = Object.entries(mainAgg).sort(([, a], [, b]) => b - a).slice(0, 10);
        chart.data.labels = sortedEntries.map(([label]) => label);
        const datasets = [{ ...chart.data.datasets[0], data: sortedEntries.map(([, value]) => value) }];
        if (isComparisonActive && chart.data.datasets[1] && compAgg) {
            const compData = sortedEntries.map(([label]) => compAgg[label] || 0);
            datasets.push({ ...chart.data.datasets[1], data: compData });
        }
        chart.data.datasets = datasets;
        chart.update();
    };
    
    if (charts.ventasCategoria.options) {
        charts.ventasCategoria.options.onClick = (evt, elements) => {
            if (elements.length > 0) showCategoryDetails(charts.ventasCategoria.data.labels[elements[0].index]);
        };
    }
    updateChart(charts.ventasCategoria, mainProcessed.byCategory, compProcessed.byCategory);

    if (charts.ventasUsuario) {
        const sortedUsers = Object.entries(mainProcessed.byUser).sort(([, a], [, b]) => b.sales - a.sales).slice(0, 10);
        charts.ventasUsuario.data.labels = sortedUsers.map(([user]) => user);
        
        const datasets = [{
            label: 'Ventas Actual (€)',
            data: sortedUsers.map(([, data]) => data.sales),
            backgroundColor: 'rgba(75, 192, 192, 0.6)',
        }];

        if (isComparisonActive) {
            const comparisonSalesData = sortedUsers.map(([user]) => (compProcessed.byUser[user] ? compProcessed.byUser[user].sales : 0));
            datasets.push({
                label: 'Ventas Anterior (€)',
                data: comparisonSalesData,
                backgroundColor: 'rgba(201, 203, 207, 0.6)',
            });
        }
        charts.ventasUsuario.data.datasets = datasets;
        charts.ventasUsuario.update();
    }
    
    // Llamamos a la nueva función para las listas Top 5
    updateTopProducts(mainData);
}