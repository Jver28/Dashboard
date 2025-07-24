/**
 * Convierte un color hexadecimal a formato RGBA.
 * @param {string} hex - El color en formato hexadecimal (ej: '#FF5733').
 * @param {number} alpha - El valor de opacidad (de 0 a 1).
 * @returns {string} El color en formato RGBA (ej: 'rgba(255, 87, 51, 1)').
 */
export function hexToRgba(hex, alpha = 1) {
    if (!hex || !hex.startsWith('#')) return `rgba(128, 222, 234, ${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Genera el HTML para el indicador de comparación de KPIs.
 * @param {number} current - El valor del periodo actual.
 * @param {number} previous - El valor del periodo anterior.
 * @returns {string} El snippet HTML con la comparación.
 */
export function getComparisonHtml(current, previous) {
    const comparisonSelector = document.getElementById('comparisonSelector');
    if (previous === null || previous === undefined || comparisonSelector.value === 'none') return '';
    if (previous === 0) {
        return current > 0 ? `<span class="comparison increase">▲ Nuevo</span>` : '';
    }
    if (current === previous) return `<span class="comparison">→ 0%</span>`;
    
    const diff = ((current - previous) / previous) * 100;
    const cssClass = diff >= 0 ? 'increase' : 'decrease';
    const arrow = diff >= 0 ? '▲' : '▼';
    return `<span class="comparison ${cssClass}">${arrow} ${diff.toFixed(1)}%</span>`;
}

/**
 * Calcula las fechas del periodo de comparación.
 * @param {string} startDateStr - Fecha de inicio 'YYYY-MM-DD'.
 * @param {string} endDateStr - Fecha de fin 'YYYY-MM-DD'.
 * @param {string} type - El tipo de comparación ('previous' o 'last_year').
 * @returns {object|null} Un objeto con las fechas { from, to } o null.
 */
export function getComparisonDates(startDateStr, endDateStr, type) {
    if (type === 'none') return null;
    const from = new Date(startDateStr + 'T00:00:00');
    const to = new Date(endDateStr + 'T23:59:59');
    let compFrom = new Date(from);
    let compTo = new Date(to);

    if (type === 'previous') {
        const diff = to.getTime() - from.getTime();
        compFrom.setTime(from.getTime() - diff - (24 * 60 * 60 * 1000));
        compTo.setTime(from.getTime() - 1);
    } else if (type === 'last_year') {
        compFrom.setFullYear(compFrom.getFullYear() - 1);
        compTo.setFullYear(compTo.getFullYear() - 1);
    }
    return { from: compFrom.toISOString().split('T')[0], to: compTo.toISOString().split('T')[0] };
}

/**
 * Parsea el texto de los detalles de una merma para extraer el motivo y los productos.
 * @param {string} details - El texto completo del campo de detalles.
 * @returns {object} Un objeto con { motivo, productos: [{ nombre, cantidad }] }.
 */
export function parseMermaDetails(details) {
    if (!details) {
        return { motivo: 'Sin Motivo', productos: [] };
    }
    const motivoMatch = details.match(/Motivo:\s*(.*?)(?=\s*Líneas:|$)/s);
    const motivo = motivoMatch ? motivoMatch[1].trim() : 'Sin Motivo';
    const lineasMatch = details.match(/Líneas:\s*(.*)/s);
    if (!lineasMatch || !lineasMatch[1]) {
        return { motivo, productos: [] };
    }

    const lineasStr = lineasMatch[1];
    const productosAgrupados = {};
    const regex = /(.+?) Cantidad: ([\d,.]+)/g;
    let match;

    while ((match = regex.exec(lineasStr)) !== null) {
        const nombre = match[1].trim();
        const cantidad = parseFloat(match[2].replace(',', '.'));
        if (nombre && !isNaN(cantidad)) {
            productosAgrupados[nombre] = (productosAgrupados[nombre] || 0) + cantidad;
        }
    }
    
    const productosFinal = Object.keys(productosAgrupados).map(nombre => ({
        nombre: nombre,
        cantidad: productosAgrupados[nombre]
    }));
    return { motivo, productos: productosFinal };
}

/**
 * Filtra un array de datos por el campo 'Local'.
 * @param {Array} data - El array de datos a filtrar.
 * @param {string} selectedLocal - El nombre del local seleccionado, o 'all'.
 * @returns {Array} El array de datos filtrado.
 */
export function filterDataByLocal(data, selectedLocal) {
    if (!data || !Array.isArray(data)) return [];
    if (!selectedLocal || selectedLocal === 'all') {
        return data; // Si se seleccionan 'Todos', no se filtra nada
    }
    return data.filter(item => item.Local === selectedLocal);
}