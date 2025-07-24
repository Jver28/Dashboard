export const config = {
    apiUrl: 'http://bocagrande.eject.es:8984/api/custom-query/',
    apiToken: 'Bocagrande2025$'
};

export const paymentMethodConfig = {
    'Tarjeta':  { color: '#80deea', dataKey: 'Tarjeta' },
    'Efectivo': { color: '#a5d6a7', dataKey: 'Efectivo' },
    'AgoraPay':    { color: '#ffcc80', dataKey: 'AgoraPay' },
    'AMEX':    { color: '#b39ddb', dataKey: 'AMEX' },
    'Transferencia':    { color: '#b39ddb', dataKey: 'Transferencia' }

};

export const analysisChartPalettes = {
    dark: ['#80deea', '#a5d6a7', '#ffcc80', '#ffab91', '#b39ddb', '#f48fb1', '#80cbc4', '#c5e1a5', '#ffe082', '#ffccbc'],
    light: ['#4dd0e1', '#81c784', '#ffb74d', '#ff8a65', '#9575cd', '#f06292', '#4db6ac', '#aed581', '#ffd54f', '#ffab91']
};