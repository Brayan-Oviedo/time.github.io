import { LocalDB } from './store/localDb.js';
import { TimeStack } from './components/TimeStack.js';
import { TimeUtils } from './utils/timeUtils.js';

// DOM Elements
const modal = document.getElementById('audit-modal');
const modalSubtitle = document.getElementById('modal-subtitle');
const durationControl = document.getElementById('duration-control');
const durationSlider = document.getElementById('duration-slider');
const durationValue = document.getElementById('duration-value');

const fab = document.getElementById('ghost-trigger');
const closeBtn = document.getElementById('close-modal');
const stackContainer = document.getElementById('time-stack-container'); 

// Dashboard Elements
const investEl = document.getElementById('invest-time');
const wasteEl = document.getElementById('waste-time');
const remainingEl = document.getElementById('remaining-mins');
const efficiencyBar = document.getElementById('efficiency-bar');

// Date Nav Elements
const prevDayBtn = document.getElementById('prev-day');
const nextDayBtn = document.getElementById('next-day');
const dateDisplay = document.getElementById('current-date-display');

// Variables de Estado
let tempGapStart = null;
let maxGapDuration = 0; 
let timerInterval = null;
let currentViewDate = new Date(); // La fecha que estamos mirando

document.addEventListener('DOMContentLoaded', () => {
    console.log('📅 1440 OS - 7-Day Audit Ready');

    const appState = LocalDB.load();
    const stack = new TimeStack('time-stack-container');
    
    // Inicializar UI de fecha
    updateDateUI();

    // Render inicial
    refreshView(stack);

    // Restaurar timer SOLO si es HOY
    if (appState.currentSession && TimeUtils.isToday(currentViewDate)) {
        activateTimerUI(appState.currentSession.start);
    }

    // Actualizar reloj de "Restante"
    setInterval(() => updateRemainingTime(), 60000);
    updateRemainingTime();

    setupInteractions(stack);
});

// --- LÓGICA DE VISTA POR FECHA ---

function refreshView(stack) {
    const appState = LocalDB.load();
    const allBlocks = appState.blocks || [];
    
    // FILTRO: Solo mostrar bloques que coincidan con la fecha seleccionada
    // Si un bloque antiguo no tiene fecha (legacy), asumimos que es de Hoy (para no perder datos viejos)
    const viewDateKey = TimeUtils.getDateKey(currentViewDate);
    const todayKey = TimeUtils.getDateKey(new Date());

    const filteredBlocks = allBlocks.filter(block => {
        if (block.dateKey) {
            return block.dateKey === viewDateKey;
        } else {
            // Migración simple: si no tiene fecha, es de hoy
            return viewDateKey === todayKey;
        }
    });

    stack.render(filteredBlocks);
    updateDashboard(filteredBlocks);
}

function updateDateUI() {
    if (TimeUtils.isToday(currentViewDate)) {
        dateDisplay.innerText = "HOY";
        nextDayBtn.disabled = true; // No ir al futuro
    } else {
        dateDisplay.innerText = TimeUtils.getDisplayDate(currentViewDate);
        nextDayBtn.disabled = false;
    }
}

function changeDay(offset, stack) {
    currentViewDate.setDate(currentViewDate.getDate() + offset);
    updateDateUI();
    refreshView(stack);
}

// --- UI DASHBOARD ---

function updateDashboard(blocks) {
    let wasteMins = 0;
    let investMins = 0;

    blocks.forEach(block => {
        const duration = block.end - block.start;
        if (block.type === 'WASTE') {
            wasteMins += duration;
        } else {
            investMins += duration;
        }
    });

    investEl.innerText = formatMins(investMins);
    wasteEl.innerText = formatMins(wasteMins);

    const totalLogged = wasteMins + investMins;
    let percentage = 100; 
    if (totalLogged > 0) percentage = (investMins / totalLogged) * 100;

    efficiencyBar.style.width = `${percentage}%`;
    
    if (percentage < 50) {
        efficiencyBar.style.backgroundColor = 'var(--accent-red)';
        efficiencyBar.style.boxShadow = '0 0 10px var(--accent-red)';
    } else {
        efficiencyBar.style.backgroundColor = 'var(--accent-purple)';
        efficiencyBar.style.boxShadow = '0 0 10px var(--accent-purple)';
    }
}

function updateRemainingTime() {
    // Si no es hoy, el restante no tiene sentido (o es 0), pero lo dejamos estático
    if (!TimeUtils.isToday(currentViewDate)) {
        remainingEl.innerText = "-";
        return;
    }

    const now = new Date();
    const mins = (now.getHours() * 60) + now.getMinutes();
    const left = 1440 - mins;
    remainingEl.innerText = left;
    if(left < 240) remainingEl.style.color = 'var(--accent-red)';
    else remainingEl.style.color = '#fff';
}

function formatMins(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
}

// --- INTERACCIONES ---
function setupInteractions(stackComponent) {
    
    // Navegación Fechas
    prevDayBtn.addEventListener('click', () => changeDay(-1, stackComponent));
    nextDayBtn.addEventListener('click', () => changeDay(1, stackComponent));

    // FAB (Live Timer)
    fab.addEventListener('click', () => {
        const state = LocalDB.load();
        if (state.currentSession) {
            // Parar timer
            tempGapStart = null; 
            showModal(false);
        } else {
            // Iniciar timer (Siempre con fecha de HOY real)
            const now = Date.now();
            LocalDB.startSession(now);
            
            // Si estoy viendo otro día, vuelvo a hoy para ver el timer
            if (!TimeUtils.isToday(currentViewDate)) {
                currentViewDate = new Date();
                updateDateUI();
                refreshView(stackComponent);
            }
            activateTimerUI(now);
        }
    });
    
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    durationSlider.addEventListener('input', (e) => {
        durationValue.innerText = `${e.target.value} min`;
    });

    document.querySelector('.modal-content').addEventListener('click', (e) => {
        const btn = e.target.closest('.opt-btn');
        if (btn) {
            const type = btn.dataset.type;
            const label = btn.innerText.trim(); 
            
            if (tempGapStart !== null) {
                // Hueco manual (usa la fecha que estamos viendo)
                const duration = parseInt(durationSlider.value);
                const calcEnd = tempGapStart + duration;
                saveBlockToDB(tempGapStart, calcEnd, type, label, stackComponent);
            } else {
                // Live Timer (usa fecha real de finalización)
                finishSessionAndLog(type, label, stackComponent);
            }
            modal.classList.add('hidden');
        }
    });

    stackContainer.addEventListener('click', (e) => {
        // Borrar
        const blockElement = e.target.closest('.time-block');
        if (blockElement) {
            const blockId = Number(blockElement.dataset.id);
            if (confirm('¿Eliminar este registro?')) {
                deleteBlock(blockId, stackComponent);
            }
            return;
        }

        // Llenar Hueco
        const gapElement = e.target.closest('.time-gap');
        if (gapElement) {
            tempGapStart = Number(gapElement.dataset.start);
            const gapEnd = Number(gapElement.dataset.end);
            
            const duration = gapEnd - tempGapStart;
            maxGapDuration = duration;
            
            durationSlider.max = maxGapDuration;
            durationSlider.value = maxGapDuration;
            durationValue.innerText = `${maxGapDuration} min`;
            
            showModal(true);
        }
    });
}

function showModal(withSlider) {
    modal.classList.remove('hidden');
    if (withSlider) {
        durationControl.classList.remove('hidden');
        modalSubtitle.innerText = "Ajusta la duración y clasifica:";
    } else {
        durationControl.classList.add('hidden');
        modalSubtitle.innerText = "¿Qué acabas de hacer?";
    }
}

// LOGICA DB
function deleteBlock(id, stackComponent) {
    const state = LocalDB.load();
    state.blocks = state.blocks.filter(b => b.id !== id);
    LocalDB.save(state);
    refreshView(stackComponent); // Usar refreshView para mantener el filtro
}

function finishSessionAndLog(type, label, stackComponent) {
    const session = LocalDB.stopSession();
    resetTimerUI();
    if (!session) return;

    const endTimeMs = Date.now();
    const startTimeMs = session.start;
    
    const startDate = new Date(startTimeMs);
    const endDate = new Date(endTimeMs);
    const start = (startDate.getHours() * 60) + startDate.getMinutes();
    const end = (endDate.getHours() * 60) + endDate.getMinutes();
    
    let duration = end - start;
    if (duration < 1) duration = 1;

    // Al finalizar sesión en vivo, usamos la fecha de HOY
    saveBlockWithDate(start, start + duration, type, label, stackComponent, new Date());
}

function saveBlockToDB(start, end, type, label, stackComponent) {
    // Al guardar manual, usamos la fecha que se está VIENDO
    saveBlockWithDate(start, end, type, label, stackComponent, currentViewDate);
    tempGapStart = null;
}

function saveBlockWithDate(start, end, type, label, stackComponent, dateObj) {
    const newBlock = {
        id: Date.now(),
        start: start,
        end: end,
        type: type,
        label: label,
        dateKey: TimeUtils.getDateKey(dateObj) // CLAVE PARA EL FILTRO
    };

    const state = LocalDB.load();
    if (!state.blocks) state.blocks = [];
    state.blocks.push(newBlock);
    LocalDB.save(state);
    
    refreshView(stackComponent);
}

function activateTimerUI(startTime) {
    fab.classList.add('active-recording');
    timerInterval = setInterval(() => {
        const now = Date.now();
        const diffSeconds = Math.floor((now - startTime) / 1000);
        const minutes = Math.floor(diffSeconds / 60);
        const seconds = diffSeconds % 60;
        fab.innerHTML = `<span style="font-size:0.8rem; font-weight:bold;">${minutes}:${seconds.toString().padStart(2,'0')}</span>`;
    }, 1000);
}

function resetTimerUI() {
    clearInterval(timerInterval);
    fab.classList.remove('active-recording');
    fab.innerHTML = `<span>+</span>`;
}