import { LocalDB } from './store/localDb.js?v=rutina-final2';
import { TimeStack } from './components/TimeStack.js';
import { TimeUtils } from './utils/timeUtils.js';

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
    const todayKey = TimeUtils.getDateKey(new Date());
    
    let filteredBlocks = (state.blocks || []).filter(block => block.dateKey === viewDateKey);
    
    if (viewDateKey >= todayKey && filteredBlocks.length === 0 && state.routines && state.routines.length > 0) {
        if (LocalDB.applyRoutines(viewDateKey)) {
            const newState = LocalDB.load();
            filteredBlocks = (newState.blocks || []).filter(block => block.dateKey === viewDateKey);
        }
    }

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
    } else {
        document.getElementById('current-date-display').innerText = TimeUtils.getDisplayDate(currentViewDate);
    }
    document.getElementById('next-day').disabled = false;
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
            if (rule.decision === 'routine') decisionText = '🔄 RUTINA DIARIA'; 
            
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
    
    // DOBLE TOQUE: LIMPIAR SEMANA Y REGLAS (PWA SAFE)
    const resetBtn = document.getElementById('plan-next-week-btn');
    resetBtn.addEventListener('click', () => {
        if (resetBtn.dataset.ready === 'true') {
            const state = LocalDB.load();
            state.blocks = []; 
            
            // MAGIA: Borra también las reglas pasadas
            state.rules = []; 
            
            LocalDB.save(state);
            refreshView(stack);
            reviewModal.classList.add('hidden');
            
            resetBtn.dataset.ready = 'false';
            resetBtn.innerText = 'Limpiar Semana y Planificar';
            resetBtn.style.background = 'var(--accent-purple)';
        } else {
            resetBtn.dataset.ready = 'true';
            resetBtn.innerText = '⚠️ Toca de nuevo para confirmar';
            resetBtn.style.background = 'var(--accent-red)';
            setTimeout(() => {
                resetBtn.dataset.ready = 'false';
                resetBtn.innerText = 'Limpiar Semana y Planificar';
                resetBtn.style.background = 'var(--accent-purple)';
            }, 3000);
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

    function getEventY(e) { return e.touches ? e.touches[0].clientY : e.clientY; }

    stackContainer.addEventListener('mousedown', handleDragStart);
    stackContainer.addEventListener('touchstart', handleDragStart, {passive: false});

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('touchmove', handleDragMove, {passive: false});

    document.addEventListener('mouseup', (e) => handleDragEnd(e, stack));
    document.addEventListener('touchmove', (e) => handleDragEnd(e, stack));

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
            const currentY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
            const diff = currentY - drag.startY;
            
            const minDiff = Math.floor(diff / 2); 
            const snappedDiff = Math.round(minDiff / 15) * 15; 
            
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
            if(!schedulingItem) {
                tempJudgeBlockId = drag.id;
                const blockData = LocalDB.load().blocks.find(b => b.id === tempJudgeBlockId);
                if(blockData) {
                    document.getElementById('judge-activity-name').innerText = blockData.label;
                    
                    const normalDeleteBtn = document.getElementById('normal-delete-btn');
                    const makeRoutineBtn = document.getElementById('make-routine-btn');
                    const removeRoutineBtn = document.getElementById('remove-routine-btn');
                    
                    if (blockData.decision === 'routine') {
                        if(normalDeleteBtn) normalDeleteBtn.style.display = 'none';
                        if(makeRoutineBtn) makeRoutineBtn.style.display = 'none';
                        if(removeRoutineBtn) removeRoutineBtn.style.display = 'block';
                    } else {
                        if(normalDeleteBtn) normalDeleteBtn.style.display = 'block';
                        if(makeRoutineBtn) makeRoutineBtn.style.display = 'block';
                        if(removeRoutineBtn) removeRoutineBtn.style.display = 'none';
                    }

                    const delBtn = document.getElementById('judge-remove-error');
                    delBtn.dataset.ready = 'false';
                    delBtn.innerText = 'Borrar (Me equivoqué al anotar)';

                    judgeModal.classList.remove('hidden');
                }
            }
        }
        
        drag.el.style.transform = '';
        drag.el.style.zIndex = '';
        drag.el.style.boxShadow = '';
        drag = { el: null, id: null, startY: 0, originalStart: 0, isDragging: false };
    }

    stackContainer.addEventListener('click', (e) => {
        const gapElement = e.target.closest('.time-gap');
        if (gapElement && !drag.isDragging) {
            const rect = stackContainer.getBoundingClientRect();
            const clickY = e.clientY - rect.top + stackContainer.scrollTop;
            let clickedMin = Math.floor(clickY / 2); 
            
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

    // --- ACCIONES DEL JUEZ SIN ALERTS ---
    document.querySelectorAll('.judge-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (tempJudgeBlockId) {
                const decision = e.currentTarget.dataset.decision;
                const state = LocalDB.load();
                const block = state.blocks.find(b => b.id === tempJudgeBlockId);
                
                if (block && decision) {
                    if (e.currentTarget.id === 'make-routine-btn') {
                        LocalDB.addRoutine(block);
                        LocalDB.updateBlockDecision(tempJudgeBlockId, 'routine');
                        LocalDB.addSystemRule(block.label, 'routine');
                    } else if (e.currentTarget.id === 'remove-routine-btn') {
                        LocalDB.removeRoutine(block);
                        LocalDB.removeSystemRule(block.label);
                        LocalDB.updateBlockDecision(tempJudgeBlockId, null); 
                    } else {
                        if (decision === 'delete' || decision === 'delegate' || decision === 'automate') {
                            LocalDB.removeRoutine(block); 
                        }
                        LocalDB.updateBlockDecision(tempJudgeBlockId, decision);
                        LocalDB.addSystemRule(block.label, decision);
                    }
                }
                
                refreshView(stack);
                judgeModal.classList.add('hidden');
                tempJudgeBlockId = null;
            }
        });
    });

    const delBtn = document.getElementById('judge-remove-error');
    delBtn.addEventListener('click', () => {
        if (delBtn.dataset.ready === 'true') {
            const state = LocalDB.load();
            const block = state.blocks.find(b => b.id === tempJudgeBlockId);
            if (block) { LocalDB.removeRoutine(block); }
            
            state.blocks = state.blocks.filter(b => b.id !== tempJudgeBlockId);
            LocalDB.save(state);
            refreshView(stack); 
            judgeModal.classList.add('hidden');
            tempJudgeBlockId = null;
            
            delBtn.dataset.ready = 'false';
            delBtn.innerText = 'Borrar (Me equivoqué al anotar)';
        } else {
            delBtn.dataset.ready = 'true';
            delBtn.innerText = '⚠️ ¿Seguro? Toca de nuevo';
            setTimeout(() => {
                delBtn.dataset.ready = 'false';
                delBtn.innerText = 'Borrar (Me equivoqué al anotar)';
            }, 3000);
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