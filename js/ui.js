import { updateAllChartsTheme } from './charts.js';

export function setupNavigation(state, callback) {
    const navLinks = document.querySelectorAll('.nav-menu a');
    const contentSections = document.querySelectorAll('.content-section');
    const mainTitle = document.getElementById('main-title');

    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            const targetId = link.getAttribute('href').substring(1);
            
            contentSections.forEach(section => {
                section.classList.toggle('active', section.id === targetId);
            });
            mainTitle.textContent = link.querySelector('.nav-text').textContent.trim();
            
            callback(false, state);
        });
    });
}

export function setupThemeSwitcher() {
    const themeSwitcher = document.getElementById('theme-switcher');
    
    const applyTheme = (theme) => {
        document.documentElement.classList.toggle('light-mode', theme === 'light');
        document.getElementById('theme-text').textContent = theme === 'light' ? 'Modo Oscuro' : 'Modo Claro';
        document.querySelector('#theme-switcher i').className = theme === 'light' ? 'bi bi-moon-fill' : 'bi bi-sun-fill';
        updateAllChartsTheme();
    };

    themeSwitcher.addEventListener('click', () => {
        const newTheme = document.documentElement.classList.contains('light-mode') ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });

    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);
}

export function setupControls(callback) {
    const refreshButton = document.getElementById('refreshDataBtn');
    const comparisonSelector = document.getElementById('comparisonSelector');
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');

    const today = new Date().toISOString().split('T')[0];
    dateFromInput.value = today;
    dateToInput.value = today;

    refreshButton.addEventListener('click', () => callback(true));
    comparisonSelector.addEventListener('change', () => callback(true));
    dateFromInput.addEventListener('change', () => callback(true));
    dateToInput.addEventListener('change', () => callback(true));
}

export function setupModal(callback) {
    const compareMethodsBtn = document.getElementById('compareMethodsBtn');
    const modal = document.getElementById('comparison-modal');
    const closeModalBtn = document.getElementById('closeModalBtn');

    if (compareMethodsBtn) {
        compareMethodsBtn.addEventListener('click', () => {
            callback();
            modal.style.display = 'flex';
        });
    }

    if(closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    if(modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
}