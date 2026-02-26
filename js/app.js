import { LocalDB } from './store/localDb.js';
import { TimeStack } from './components/TimeStack.js';
import { TimeUtils } from './utils/timeUtils.js';

// DOM
const auditModal = document.getElementById('audit-modal');
const judgeModal = document.getElementById('judge-modal');
const inboxModal = document.getElementById('inbox-modal');
const reviewModal = document.getElementById('review-modal');

const fab = document.getElementById('ghost-trigger');
const stackContainer = document.getElementById('time-stack-container'); 
const durationControl = document.getElementById('duration-control');
const durationSlider = document.getElementById('duration-slider');
const durationValue = document.getElementById('duration-value');

const mainTitle = document.getElementById('main-title');
const openInboxBtn = document.getElementById('open-inbox-btn');
const cancelScheduleBtn = document.getElementById('cancel-schedule-btn');

let tempGapStart = null;
let tempJudgeBlockId = null;
let schedulingItem = null; 
let currentViewDate = new Date(); 
let timerInterval = null;

// --- ESTADO PARA DRAG & DROP ---
let drag = { el: null, id: null, startY: 0, originalStart: 0, isDragging: false };

document.addEventListener('DOMContentLoaded', () => {
    const appState = LocalDB.load();
    const stack = new TimeStack('time-stack-container');
    
    updateDateUI();
    refreshView(stack);
    renderInbox();

    if (appState.currentSession && TimeUtils.isToday(currentViewDate)) {
        activateTimerUI(appState.currentSession.start);
    }
    
    setInterval(() => updateRemainingTime(), 60000);
    updateRemainingTime();
    setupInteractions(stack);
});

function refreshView(stack) {
    const state = LocalDB.load();
    const viewDateKey = TimeUtils.getDateKey(currentViewDate);
    const filteredBlocks = (state.blocks || []).filter(block => block.dateKey === viewDateKey);
    stack.render(filteredBlocks);
    updateDashboard(filteredBlocks);
}

function updateDashboard(blocks) {
    let wasteMins = 0; let investMins = 0;
    blocks.forEach(b => {
        const d = b.end - b.start;
        if (b.type === 'WASTE') wasteMins += d; else investMins += d;
    });
    document.getElementById('invest-time').innerText = `${Math.floor(investMins/60)}h ${investMins%60}m`;
    document.getElementById('waste-time').innerText = `${Math.floor(wasteMins/60)}h ${wasteMins%60}m`;
    
    const perc = (wasteMins + investMins) > 0 ? (investMins / (wasteMins + investMins)) * 100 : 100;
    const bar = document.getElementById('efficiency-bar');
    bar.style.width = `${perc}%`;
    bar.style.backgroundColor = perc < 50 ? 'var(--accent-red)' : 'var(--accent-purple)';
}

function updateDateUI() {
    if (TimeUtils.isToday(currentViewDate)) {
        document.getElementById('current-date-display').innerText = "HOY";
        document.getElementById('next-day').disabled = true;
    } else {
        document.getElementById('current-date-display').innerText = TimeUtils.getDisplayDate(currentViewDate);
        document.getElementById('next-day').disabled = false;
    }
}

function updateRemainingTime() {
    const el = document.getElementById('remaining-mins');
    if (!TimeUtils.isToday(currentViewDate)) { el.innerText = "-"; return; }
    const now = new Date();
    const left = 1440 - ((now.getHours() * 60) + now.getMinutes());
    el.innerText = left;
    el.style.color = left < 240 ? 'var(--accent-red)' : '#fff';
}

function startScheduling(item) {
    schedulingItem = item;
    inboxModal.classList.add('hidden');
    mainTitle.innerText = "Selecciona hueco"; 
    mainTitle.style.color = "var(--accent-purple)";
    openInboxBtn.classList.add('hidden');
    cancelScheduleBtn.classList.remove('hidden');
    document.body.classList.add('scheduling-mode'); 

    if (!TimeUtils.isToday(currentViewDate)) {
        currentViewDate = new Date(); updateDateUI(); refreshView(new TimeStack('time-stack-container'));
    }
}

function stopScheduling() {
    schedulingItem = null;
    mainTitle.innerText = "1440";
    mainTitle.style.color = "";
    openInboxBtn.classList.remove('hidden');
    cancelScheduleBtn.classList.add('hidden');
    document.body.classList.remove('scheduling-mode');
}

function renderInbox() {
    const state = LocalDB.load();
    document.getElementById('inbox-list').innerHTML = '';
    document.getElementById('inbox-badge').innerText = state.inbox.length;
    
    state.inbox.forEach(item => {
        const li = document.createElement('li');
        li.className = 'inbox-item';
        li.innerHTML = `<span>${item.text}</span><button class="inbox-item-delete" data-id="${item.id}">🗑️</button>`;
        
        li.addEventListener('click', (e) => {
            if(!e.target.classList.contains('inbox-item-delete')) {
                startScheduling(item);
            }
        });
        document.getElementById('inbox-list').appendChild(li);
    });

    document.querySelectorAll('.inbox-item-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            LocalDB.removeInboxItem(Number(e.target.dataset.id));
            renderInbox();
        });
    });
}

function renderReviewModal() {
    const state = LocalDB.load();
    let investTotal = 0; let wasteTotal = 0;

    (state.blocks || []).forEach(b => {
        const duration = b.end - b.start;
        if(b.type === 'WASTE') wasteTotal += duration;
        else investTotal += duration;
    });

    document.getElementById('review-invest-total').innerText = `${Math.floor(investTotal/60)}h ${investTotal%60}m`;
    document.getElementById('review-waste-total').innerText = `${Math.floor(wasteTotal/60)}h ${wasteTotal%60}m`;

    const rulesList = document.getElementById('review-rules-list');
    rulesList.innerHTML = '';
    
    if (!state.rules || state.rules.length === 0) {
        rulesList.innerHTML = '<p style="color:#666; font-size:0.8rem; text-align:center; padding: 20px;">Aún no has creado reglas con El Juez.</p>';
    } else {
        state.rules.forEach(rule => {
            const li = document.createElement('li');
            li.className = 'rule-item';
            let decisionText = '';
            if (rule.decision === 'delete') decisionText = '🗑️ ELIMINAR';
            if (rule.decision === 'delegate') decisionText = '🤝 DELEGAR';
            if (rule.decision === 'automate') decisionText = '⚙️ SISTEMATIZAR';
            
            li.innerHTML = `<span class="rule-decision">${decisionText}</span><span>${rule.label}</span>`;
            rulesList.appendChild(li);
        });
    }
}

function setupInteractions(stack) {
    document.getElementById('prev-day').addEventListener('click', () => { currentViewDate.setDate(currentViewDate.getDate() - 1); updateDateUI(); refreshView(stack); });
    document.getElementById('next-day').addEventListener('click', () => { currentViewDate.setDate(currentViewDate.getDate() + 1); updateDateUI(); refreshView(stack); });

    document.getElementById('open-inbox-btn').addEventListener('click', () => inboxModal.classList.remove('hidden'));
    document.getElementById('close-inbox').addEventListener('click', () => inboxModal.classList.add('hidden'));
    document.getElementById('add-inbox-btn').addEventListener('click', () => {
        const val = document.getElementById('inbox-input').value.trim();
        if(val) { LocalDB.addInboxItem(val); document.getElementById('inbox-input').value = ''; renderInbox(); }
    });
    
    cancelScheduleBtn.addEventListener('click', stopScheduling);

    document.getElementById('open-review-btn').addEventListener('click', () => {
        renderReviewModal();
        reviewModal.classList.remove('hidden');
    });
    document.getElementById('close-review').addEventListener('click', () => reviewModal.classList.add('hidden'));
    
    document.getElementById('plan-next-week-btn').addEventListener('click', () => {
        if(confirm('¿Estás seguro? Esto borrará tus bloques de tiempo para empezar una nueva semana de cero. Tus reglas de sistema se mantendrán.')) {
            const state = LocalDB.load();
            state.blocks = []; 
            LocalDB.save(state);
            refreshView(stack);
            reviewModal.classList.add('hidden');
            alert('Semana reseteada. Es hora de agendar tus Rocas Grandes en el calendario.');
        }
    });

    fab.addEventListener('click', () => {
        if (LocalDB.load().currentSession) {
            tempGapStart = null; 
            document.getElementById('modal-subtitle').innerText = "¿Qué actividad realizaste?";
            auditModal.classList.remove('hidden'); durationControl.classList.add('hidden');
        } else {
            const now = Date.now(); LocalDB.startSession(now); activateTimerUI(now);
        }
    });
    
    document.getElementById('close-modal').addEventListener('click', () => auditModal.classList.add('hidden'));
    document.getElementById('close-judge').addEventListener('click', () => {
        judgeModal.classList.add('hidden');
        tempJudgeBlockId = null; 
    });

    document.querySelector('#audit-modal .modal-content').addEventListener('click', (e) => {
        const btn = e.target.closest('.opt-btn');
        if (btn && btn.id !== 'plan-next-week-btn') {
            const type = btn.dataset.type;
            const label = schedulingItem ? schedulingItem.text : btn.innerText.trim();
            
            if (tempGapStart !== null) {
                const duration = parseInt(durationSlider.value);
                saveBlockWithDate(tempGapStart, tempGapStart + duration, type, label, stack, currentViewDate);
                tempGapStart = null;
            } else {
                finishLiveSession(type, label, stack);
            }
            
            if (schedulingItem) {
                LocalDB.removeInboxItem(schedulingItem.id);
                stopScheduling();
                renderInbox();
            }
            auditModal.classList.add('hidden');
        }
    });

    durationSlider.addEventListener('input', (e) => { durationValue.innerText = `${e.target.value} min`; });

    // --- DRAG & DROP ENGINE ---
    function getEventY(e) { return e.touches ? e.touches[0].clientY : e.clientY; }

    stackContainer.addEventListener('mousedown', handleDragStart);
    stackContainer.addEventListener('touchstart', handleDragStart, {passive: false});

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('touchmove', handleDragMove, {passive: false});

    document.addEventListener('mouseup', (e) => handleDragEnd(e, stack));
    document.addEventListener('touchend', (e) => handleDragEnd(e, stack));

    function handleDragStart(e) {
        const block = e.target.closest('.time-block');
        if (!block) return;
        
        drag.el = block;
        drag.id = Number(block.dataset.id);
        drag.startY = getEventY(e);
        drag.isDragging = false;
        
        const state = LocalDB.load();
        const b = state.blocks.find(x => x.id === drag.id);
        if(b) drag.originalStart = b.start;
    }

    function handleDragMove(e) {
        if (!drag.el) return;
        const currentY = getEventY(e);
        const diff = currentY - drag.startY;
        
        // Sensibilidad: Si mueve el dedo más de 10px, es un arrastre (Drag)
        if (Math.abs(diff) > 10) { 
            drag.isDragging = true;
            drag.el.style.transform = `translateY(${diff}px)`;
            drag.el.style.boxShadow = "0 10px 25px rgba(0,0,0,0.8)";
            drag.el.style.zIndex = 1000;
            if(e.cancelable) e.preventDefault(); 
        }
    }

    function handleDragEnd(e, stackComponent) {
        if (!drag.el) return;
        
        if (drag.isDragging) {
            // Terminó de arrastrar: Guardar nueva hora
            const currentY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
            const diff = currentY - drag.startY;
            
            const minDiff = Math.floor(diff / 2); 
            const snappedDiff = Math.round(minDiff / 15) * 15; // Redondear a 15 min
            
            const state = LocalDB.load();
            const b = state.blocks.find(x => x.id === drag.id);
            if(b) {
                const duration = b.end - b.start;
                let newStart = drag.originalStart + snappedDiff;
                
                if(newStart < 0) newStart = 0;
                if(newStart + duration > 1440) newStart = 1440 - duration;
                
                b.start = newStart;
                b.end = newStart + duration;
                LocalDB.save(state);
            }
            refreshView(stackComponent);
        } else {
            // NO hubo arrastre, fue un CLICK normal -> Abrir El Juez
            if(!schedulingItem) {
                tempJudgeBlockId = drag.id;
                const blockData = LocalDB.load().blocks.find(b => b.id === tempJudgeBlockId);
                if(blockData) {
                    document.getElementById('judge-activity-name').innerText = blockData.label;
                    judgeModal.classList.remove('hidden');
                }
            }
        }
        
        // Reset variables visuales
        drag.el.style.transform = '';
        drag.el.style.zIndex = '';
        drag.el.style.boxShadow = '';
        drag = { el: null, id: null, startY: 0, originalStart: 0, isDragging: false };
    }

    // --- CLICK EN HUECO GRIS (TAP-TO-TIME) ---
    stackContainer.addEventListener('click', (e) => {
        const gapElement = e.target.closest('.time-gap');
        if (gapElement && !drag.isDragging) {
            
            // Detección de pixel exacto
            const rect = stackContainer.getBoundingClientRect();
            const clickY = e.clientY - rect.top + stackContainer.scrollTop;
            let clickedMin = Math.floor(clickY / 2); 
            
            // Redondear a 15 mins (Ej. 14:15, 14:30)
            clickedMin = Math.round(clickedMin / 15) * 15;
            
            const gapStart = Number(gapElement.dataset.start);
            const gapEnd = Number(gapElement.dataset.end);
            
            if (clickedMin < gapStart) clickedMin = gapStart;
            if (clickedMin >= gapEnd) clickedMin = gapStart; 
            
            tempGapStart = clickedMin;
            
            let maxAvailable = gapEnd - tempGapStart;
            let duration = maxAvailable > 30 ? 30 : maxAvailable;
            if (duration < 1) duration = 1;
            
            durationSlider.max = maxAvailable;
            durationSlider.value = duration;
            durationValue.innerText = `${duration} min`;
            
            const timeString = TimeUtils.minutesToTime(tempGapStart);
            
            document.getElementById('modal-subtitle').innerText = schedulingItem 
                ? `Agendando "${schedulingItem.text}" desde las ${timeString}` 
                : `Ajusta la duración desde las ${timeString}:`;
                
            durationControl.classList.remove('hidden');
            auditModal.classList.remove('hidden');
        }
    });

    // --- ACCIONES DEL JUEZ ---
    document.querySelectorAll('.judge-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (tempJudgeBlockId) {
                const state = LocalDB.load();
                const block = state.blocks.find(b => b.id === tempJudgeBlockId);
                
                if(block) {
                    LocalDB.updateBlockDecision(tempJudgeBlockId, e.currentTarget.dataset.decision);
                    LocalDB.addSystemRule(block.label, e.currentTarget.dataset.decision);
                    alert('Regla guardada para tu Revisión Semanal.');
                }
                
                refreshView(stack);
                judgeModal.classList.add('hidden');
                tempJudgeBlockId = null;
            }
        });
    });

    document.getElementById('judge-remove-error').addEventListener('click', () => {
        if (confirm('¿Borrar registro permanentemente?')) {
            const state = LocalDB.load();
            state.blocks = state.blocks.filter(b => b.id !== tempJudgeBlockId);
            LocalDB.save(state);
            refreshView(stack); 
            judgeModal.classList.add('hidden');
            tempJudgeBlockId = null;
        }
    });
}

function finishLiveSession(type, label, stack) {
    const session = LocalDB.stopSession(); resetTimerUI();
    if (!session) return;
    const now = new Date();
    const start = (new Date(session.start).getHours() * 60) + new Date(session.start).getMinutes();
    const end = (now.getHours() * 60) + now.getMinutes();
    let duration = end - start; if (duration < 1) duration = 1;
    saveBlockWithDate(start, start + duration, type, label, stack, new Date());
}

function saveBlockWithDate(start, end, type, label, stack, dateObj) {
    const state = LocalDB.load();
    if (!state.blocks) state.blocks = [];
    state.blocks.push({ id: Date.now(), start: start, end: end, type: type, label: label, dateKey: TimeUtils.getDateKey(dateObj) });
    LocalDB.save(state); refreshView(stack);
}

function activateTimerUI(startTime) {
    fab.classList.add('active-recording');
    timerInterval = setInterval(() => {
        const diff = Math.floor((Date.now() - startTime) / 1000);
        fab.innerHTML = `<span style="font-size:0.8rem; font-weight:bold;">${Math.floor(diff/60)}:${(diff%60).toString().padStart(2,'0')}</span>`;
    }, 1000);
}

function resetTimerUI() { clearInterval(timerInterval); fab.classList.remove('active-recording'); fab.innerHTML = `<span>+</span>`; }