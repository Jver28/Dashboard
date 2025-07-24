import { createAllCharts } from './charts.js';
import { setupNavigation, setupThemeSwitcher } from './ui.js';
import { fetchDualPeriodData } from './api.js';
import { getComparisonDates, filterDataByLocal } from './utils.js';
import { updateResumenPage, setupResumenInteractivity } from './page_resumen.js';
import { updateVentasPage } from './page_ventas.js';
import { updateRentabilidadPage } from './page_rentabilidad.js';
import { updateOperacionesPage } from './page_operaciones.js';
import { updateServiciosPage } from './page_servicios.js';

let uniqueLocales = new Set();
let localesPopulated = false;

function setDefaultDates() {
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    if (dateFrom && !dateFrom.value) dateFrom.value = todayString;
    if (dateTo && !dateTo.value) dateTo.value = todayString;
}

function populateLocalSelector() {
    if (localesPopulated && uniqueLocales.size > 0) return;
    const selector = document.getElementById('localSelector');
    if (!selector || uniqueLocales.size === 0) return;

    const currentSelection = selector.value;
    selector.innerHTML = '<option value="all">Todos los locales</option>';

    [...uniqueLocales].sort().forEach(local => {
        if (local) {
            const option = document.createElement('option');
            option.value = local;
            option.textContent = local;
            selector.appendChild(option);
        }
    });
    selector.value = currentSelection;
    localesPopulated = true;
}

function handleResponsiveControls() {
    const isMobile = window.innerWidth <= 768;
    const desktopControlsContainer = document.getElementById('desktop-controls-wrapper');
    const sidebarBottomContainer = document.getElementById('sidebar-bottom-container');
    const modalControlsContainer = document.getElementById('modal-controls-container');

    const controlsTemplate = document.getElementById('controls-template');
    const themeSwitcherTemplate = document.getElementById('theme-switcher-template');

    if (!desktopControlsContainer || !sidebarBottomContainer || !modalControlsContainer || !controlsTemplate || !themeSwitcherTemplate) return;

    // Clonamos los controles desde las plantillas para evitar moverlos
    const controls = controlsTemplate.content.cloneNode(true);
    const themeSwitcher = themeSwitcherTemplate.content.cloneNode(true);

    if (isMobile) {
        if (modalControlsContainer.children.length === 0) {
            modalControlsContainer.appendChild(controls);
            modalControlsContainer.appendChild(themeSwitcher);
        }
    } else {
        if (desktopControlsContainer.children.length === 0) {
            desktopControlsContainer.appendChild(controls);
            sidebarBottomContainer.appendChild(themeSwitcher);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    handleResponsiveControls(); // Mueve los controles a su sitio ANTES de inicializar nada más
    
    const state = {
        resumen: {},
        ventas: {},
        rentabilidad: {},
        operaciones: {},
        servicios: {},
        selectedLocal: 'all'
    };

    setDefaultDates();
    createAllCharts(state);
    setupThemeSwitcher();
    setupNavigation(state, (forceReload) => loadDataForVisibleSection(forceReload, state));

    const settingsModal = document.getElementById('settings-modal');
    const settingsBtn = document.getElementById('settingsBtn');
    const closeSettingsBtn = document.getElementById('closeSettingsModalBtn');
    const applySettingsBtn = document.getElementById('applySettingsBtn');

    if (settingsBtn) settingsBtn.onclick = () => { if(settingsModal) settingsModal.style.display = 'flex'; };
    if (closeSettingsBtn) closeSettingsBtn.onclick = () => { if(settingsModal) settingsModal.style.display = 'none'; };
    if (applySettingsBtn) {
        applySettingsBtn.onclick = () => {
            if(settingsModal) settingsModal.style.display = 'none';
            loadDataForVisibleSection(true, state);
        };
    }
    if (settingsModal) {
        settingsModal.onclick = (e) => {
            if (e.target === settingsModal) settingsModal.style.display = 'none';
        };
    }

    window.addEventListener('resize', handleResponsiveControls);

    document.body.addEventListener('change', (e) => {
        if (window.innerWidth > 768 && ['dateFrom', 'dateTo', 'comparisonSelector', 'localSelector'].includes(e.target.id)) {
            if (e.target.id === 'localSelector') {
                state.selectedLocal = e.target.value;
                loadDataForVisibleSection(false, state);
            } else {
                loadDataForVisibleSection(true, state);
            }
        }
    });

    document.body.addEventListener('click', (e) => {
        if (window.innerWidth > 768 && e.target.closest('#refreshDataBtn')) {
            localforage.clear().then(() => {
                alert('Caché limpiada.');
                loadDataForVisibleSection(true, state);
            });
        }
    });
    
    loadDataForVisibleSection(true, state);

    async function loadDataForVisibleSection(forceReload = false, currentState) {
        const activeLink = document.querySelector('.nav-menu a.active');
        if (!activeLink) return;
        
        const targetId = activeLink.getAttribute('href').substring(1);

        // =================================================================
        // --- 💣 AQUÍ LA MEJORA PARA MOSTRAR EL SKELETON 💣 ---
        // Nos aseguramos de que el contenido real esté oculto 
        // y el placeholder (con nuestro esqueleto) esté visible.
        const content = document.getElementById(`${targetId}-content`);
        const placeholder = document.getElementById(`${targetId}-placeholder`);

        if (content) content.style.display = 'none';
        // Usamos flex para que los elementos del esqueleto se alineen correctamente
        if (placeholder) placeholder.style.display = 'flex'; 
        // =================================================================

        document.dispatchEvent(new CustomEvent('api:loading-start', { detail: { message: `Cargando ${targetId}...` } }));

        const mainDates = { from: document.getElementById('dateFrom').value, to: document.getElementById('dateTo').value };
        const comparisonDates = getComparisonDates(mainDates.from, mainDates.to, document.getElementById('comparisonSelector').value);
        
        try {
            const selectedLocal = document.getElementById('localSelector').value;
            currentState.selectedLocal = selectedLocal;

            if (targetId === 'resumen') {
                if (forceReload || !currentState.resumen.main) {
                     const [mainData, comparisonData] = await fetchDualPeriodData('{informe-metodos-pago-dashboard}', mainDates, comparisonDates, 'Fecha');
                     (mainData || []).forEach(item => item.Local && uniqueLocales.add(item.Local));
                     populateLocalSelector();
                     currentState.resumen = { main: mainData, comparison: comparisonData };
                }
                const filteredMain = filterDataByLocal(currentState.resumen.main, selectedLocal);
                const filteredComp = filterDataByLocal(currentState.resumen.comparison, selectedLocal);
                updateResumenPage(filteredMain, filteredComp, currentState);
                setupResumenInteractivity(currentState); 
            } else if (targetId === 'ventas' || targetId === 'rentabilidad') {
                if (forceReload || !currentState.ventas.main) {
                    const [mainData, comparisonData] = await fetchDualPeriodData('{informe-analisis-ventas}', mainDates, comparisonDates, 'BusinessDay');
                    (mainData || []).forEach(item => item.Local && uniqueLocales.add(item.Local));
                    populateLocalSelector();
                    currentState.ventas = { main: mainData, comparison: comparisonData };
                    currentState.rentabilidad = { main: mainData, comparison: comparisonData };
                }
                const filteredMain = filterDataByLocal(currentState.ventas.main, selectedLocal);
                const filteredComp = filterDataByLocal(currentState.ventas.comparison, selectedLocal);
                if (targetId === 'ventas') {
                    updateVentasPage(filteredMain, filteredComp);
                } else {
                    updateRentabilidadPage(filteredMain, filteredComp);
                }
            } else if (targetId === 'operaciones') {
                if (forceReload || !currentState.operaciones.main) {
                    const [[mainCancel, comparisonCancel], [mainMerma, comparisonMerma]] = await Promise.all([
                        fetchDualPeriodData('{cancelaciones-dashboard}', mainDates, comparisonDates, 'CreationDate'),
                        fetchDualPeriodData('{mermas-dashboard}', mainDates, comparisonDates, 'Time') 
                    ]);
                    currentState.operaciones = { main: { cancelaciones: mainCancel, mermas: mainMerma }, comparison: { cancelaciones: comparisonCancel, mermas: comparisonMerma } };
                }
                const filteredMain = { cancelaciones: filterDataByLocal(currentState.operaciones.main.cancelaciones, selectedLocal), mermas: filterDataByLocal(currentState.operaciones.main.mermas, selectedLocal) };
                const filteredComp = { cancelaciones: filterDataByLocal(currentState.operaciones.comparison.cancelaciones, selectedLocal), mermas: filterDataByLocal(currentState.operaciones.comparison.mermas, selectedLocal) };
                updateOperacionesPage(filteredMain, filteredComp);
            } else if (targetId === 'servicios') {
                if (forceReload || !currentState.servicios.main) {
                    const [[serviciosData], [resumenData]] = await Promise.all([
                        fetchDualPeriodData('{periodos-servicio-dashboard}', mainDates, null, 'BusinessDay'),
                        fetchDualPeriodData('{informe-metodos-pago-dashboard}', mainDates, null, 'Fecha')
                    ]);
                    (serviciosData || []).forEach(item => item.Local && uniqueLocales.add(item.Local));
                    populateLocalSelector();
                    currentState.servicios = { main: { servicios: serviciosData, resumen: resumenData } };
                }
                const filteredMain = { servicios: filterDataByLocal(currentState.servicios.main.servicios, selectedLocal), resumen: filterDataByLocal(currentState.servicios.main.resumen, selectedLocal) };
                updateServiciosPage(filteredMain);
            }
        } catch (error) {
            console.error("Error al actualizar la página:", error);
        }
        finally {
            document.dispatchEvent(new CustomEvent('api:loading-end'));
        }
    }
});