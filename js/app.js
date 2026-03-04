import { LocalDB } from './store/localDb.js?v=custom-acts';
import { TimeStack } from './components/TimeStack.js?v=fisica-final';
import { TimeUtils } from './utils/timeUtils.js';

const auditModal = document.getElementById('audit-modal');
const judgeModal = document.getElementById('judge-modal');
const inboxModal = document.getElementById('inbox-modal');
const reviewModal = document.getElementById('review-modal');
const vaultModal = document.getElementById('vault-modal'); 
const configModal = document.getElementById('config-modal');

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

let pendingGuardianData = null;

let drag = { el: null, id: null, startY: 0, originalStart: 0, isDragging: false };

document.addEventListener('DOMContentLoaded', () => {
    const appState = LocalDB.load();
    const stack = new TimeStack('time-stack-container');
    
    renderAuditActivities();
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

function renderAuditActivities() {
    const state = LocalDB.load();
    const investGrid = document.getElementById('audit-invest-grid');
    const wasteGrid = document.getElementById('audit-waste-grid');
    
    investGrid.innerHTML = '';
    wasteGrid.innerHTML = '';
    
    state.activities.forEach(act => {
        const btn = document.createElement('button');
        btn.className = act.type === 'WASTE' ? 'opt-btn waste' : 'opt-btn invest';
        btn.dataset.type = act.type;
        btn.innerText = act.label;
        
        if (act.type === 'WASTE') wasteGrid.appendChild(btn);
        else investGrid.appendChild(btn);
    });
}

function renderConfigModal() {
    const state = LocalDB.load();
    const investList = document.getElementById('config-invest-list');
    const wasteList = document.getElementById('config-waste-list');
    
    investList.innerHTML = '';
    wasteList.innerHTML = '';
    
    state.activities.forEach(act => {
        const li = document.createElement('li');
        li.className = 'inbox-item';
        li.innerHTML = `
            <span style="font-weight: bold;">${act.label}</span>
            <div style="display:flex; gap: 15px; align-items: center;">
                <button class="edit-act-btn" data-id="${act.id}" style="background:none; border:none; font-size:1.1rem; padding: 0; color: white;">✏️</button>
                <button class="delete-act-btn" data-id="${act.id}" style="background:none; border:none; font-size:1.1rem; padding: 0; color: white;">🗑️</button>
            </div>
        `;
        
        if (act.type === 'WASTE') wasteList.appendChild(li);
        else investList.appendChild(li);
    });
}

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
    const viewDateKey = TimeUtils.getDateKey(currentViewDate);
    let dailyBlocks = (state.blocks || []).filter(b => b.dateKey === viewDateKey);
    
    let investTotal = 0; let wasteTotal = 0;
    dailyBlocks.forEach(b => {
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

function renderVaultModal() {
    const state = LocalDB.load();
    let allTimeInvest = 0;
    let allTimeWaste = 0;
    const activeDays = new Set(); 

    (state.blocks || []).forEach(b => {
        const duration = b.end - b.start;
        if (b.type === 'WASTE') {
            allTimeWaste += duration;
        } else {
            allTimeInvest += duration;
        }
        activeDays.add(b.dateKey);
    });

    const totalMins = allTimeInvest + allTimeWaste;
    const efficiency = totalMins > 0 ? Math.round((allTimeInvest / totalMins) * 100) : 0;

    document.getElementById('vault-days-total').innerText = activeDays.size;
    document.getElementById('vault-efficiency-total').innerText = `${efficiency}%`;
    document.getElementById('vault-invest-total').innerText = `${Math.floor(allTimeInvest/60)}h ${allTimeInvest%60}m`;
    document.getElementById('vault-waste-total').innerText = `${Math.floor(allTimeWaste/60)}h ${allTimeWaste%60}m`;
    
    const effElement = document.getElementById('vault-efficiency-total');
    if (efficiency >= 70) effElement.style.color = '#00d084'; 
    else if (efficiency >= 50) effElement.style.color = '#ffd60a'; 
    else effElement.style.color = 'var(--accent-red)'; 
}

function processBlockSave(type, label, stackComponent) {
    if (tempGapStart !== null) {
        const duration = parseInt(durationSlider.value);
        saveBlockWithDate(tempGapStart, tempGapStart + duration, type, label, stackComponent, currentViewDate);
        tempGapStart = null;
    } else {
        finishLiveSession(type, label, stackComponent);
    }
    
    if (schedulingItem) {
        LocalDB.removeInboxItem(schedulingItem.id);
        stopScheduling();
        renderInbox();
    }
    auditModal.classList.add('hidden');
}

// === DOS RUTAS CLARAS PARA ABRIR LA AUDITORÍA ===

// Ruta 1: Cuando tocas el Cronómetro (Timer en Vivo)
function openAuditForTimer() {
    tempGapStart = null; 
    document.getElementById('modal-subtitle').innerText = "¿Qué actividad realizaste?";
    document.getElementById('duration-control').classList.add('hidden');
    
    // MUESTRA el botón de descartar
    const discardBtn = document.getElementById('discard-session-btn');
    if(discardBtn) {
        discardBtn.classList.remove('hidden');
        // Resetea su estado de doble toque por si acaso
        discardBtn.dataset.ready = 'false';
        discardBtn.innerText = '🛑 Descartar temporizador';
    }
    
    document.getElementById('close-modal').innerText = "Ocultar y seguir contando";
    auditModal.classList.remove('hidden'); 
}

// Ruta 2: Cuando tocas el Calendario (Hueco a mano)
function openAuditForGap(timeString, duration, maxAvailable) {
    document.getElementById('modal-subtitle').innerText = schedulingItem 
        ? `Agendando "${schedulingItem.text}" desde las ${timeString}` 
        : `Ajusta la duración desde las ${timeString}:`;
        
    durationSlider.max = maxAvailable.toString(); 
    durationSlider.value = duration.toString();
    durationValue.innerText = `${duration} min`;
    document.getElementById('duration-control').classList.remove('hidden');
    
    // OCULTA el botón de descartar para siempre en este modo
    const discardBtn = document.getElementById('discard-session-btn');
    if(discardBtn) {
        discardBtn.classList.add('hidden');
        // Resetea su estado interno para evitar fantasmas
        discardBtn.dataset.ready = 'false';
        discardBtn.innerText = '🛑 Descartar temporizador';
    }
    
    document.getElementById('close-modal').innerText = "Cancelar";
    auditModal.classList.remove('hidden');
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
    
    document.getElementById('open-vault-btn').addEventListener('click', () => {
        renderVaultModal();
        vaultModal.classList.remove('hidden');
    });
    document.getElementById('close-vault').addEventListener('click', () => vaultModal.classList.add('hidden'));

    document.getElementById('open-config-btn').addEventListener('click', () => {
        renderConfigModal();
        configModal.classList.remove('hidden');
        auditModal.classList.add('hidden');
    });

    document.getElementById('close-config-btn').addEventListener('click', () => {
        configModal.classList.add('hidden');
        renderAuditActivities(); 
        auditModal.classList.remove('hidden');
    });

    document.getElementById('add-invest-btn').addEventListener('click', () => {
        const val = document.getElementById('new-invest-input').value;
        if(val.trim()) { LocalDB.addActivity('INVEST', val); document.getElementById('new-invest-input').value = ''; renderConfigModal(); }
    });

    document.getElementById('add-waste-btn').addEventListener('click', () => {
        const val = document.getElementById('new-waste-input').value;
        if(val.trim()) { LocalDB.addActivity('WASTE', val); document.getElementById('new-waste-input').value = ''; renderConfigModal(); }
    });

    document.querySelectorAll('#config-invest-list, #config-waste-list').forEach(list => {
        list.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-act-btn');
            const saveBtn = e.target.closest('.save-act-btn');
            const delBtn = e.target.closest('.delete-act-btn');
            
            if (editBtn) {
                const id = Number(editBtn.dataset.id);
                const li = editBtn.closest('li');
                const currentText = li.querySelector('span').innerText;
                li.innerHTML = `
                    <input type="text" class="inline-edit-input" value="${currentText}" style="width: 70%; background: rgba(255,255,255,0.1); color: white; border: 1px solid var(--accent-purple); border-radius: 5px; padding: 8px; outline: none;">
                    <button class="save-act-btn" data-id="${id}" style="background:none; border:none; font-size:1.2rem; padding: 0;">✅</button>
                `;
            } else if (saveBtn) {
                const id = Number(saveBtn.dataset.id);
                const input = saveBtn.closest('li').querySelector('input');
                if (input && input.value.trim() !== '') {
                    LocalDB.editActivity(id, input.value);
                    renderConfigModal();
                }
            } else if (delBtn) {
                if (delBtn.dataset.ready === 'true') {
                    LocalDB.removeActivity(Number(delBtn.dataset.id));
                    renderConfigModal();
                } else {
                    delBtn.dataset.ready = 'true';
                    delBtn.innerText = '⚠️';
                    setTimeout(() => {
                        if(document.body.contains(delBtn)) {
                            delBtn.dataset.ready = 'false';
                            delBtn.innerText = '🗑️';
                        }
                    }, 3000);
                }
            }
        });
    });

    const resetBtn = document.getElementById('plan-next-week-btn');
    resetBtn.addEventListener('click', () => {
        if (resetBtn.dataset.ready === 'true') {
            const state = LocalDB.load();
            state.blocks.forEach(b => {
                if (b.decision !== 'routine') {
                    b.decision = null; 
                }
            });
            state.rules = []; 
            LocalDB.save(state);
            refreshView(stack);
            reviewModal.classList.add('hidden');
            resetBtn.dataset.ready = 'false';
            resetBtn.innerText = 'Limpiar Promesas de la Semana';
            resetBtn.style.background = 'var(--accent-purple)';
        } else {
            resetBtn.dataset.ready = 'true';
            resetBtn.innerText = '⚠️ Toca de nuevo para confirmar';
            resetBtn.style.background = 'var(--accent-red)';
            setTimeout(() => {
                resetBtn.dataset.ready = 'false';
                resetBtn.innerText = 'Limpiar Promesas de la Semana';
                resetBtn.style.background = 'var(--accent-purple)';
            }, 3000);
        }
    });

    fab.addEventListener('click', () => {
        if (LocalDB.load().currentSession) {
            openAuditForTimer();
        } else {
            const now = Date.now(); LocalDB.startSession(now); activateTimerUI(now);
        }
    });
    
    document.getElementById('close-modal').addEventListener('click', () => auditModal.classList.add('hidden'));
    
    const discardBtn = document.getElementById('discard-session-btn');
    if (discardBtn) {
        discardBtn.addEventListener('click', () => {
            if (discardBtn.dataset.ready === 'true') {
                LocalDB.stopSession(); 
                resetTimerUI();
                auditModal.classList.add('hidden');
                discardBtn.dataset.ready = 'false';
                discardBtn.innerText = '🛑 Descartar temporizador';
            } else {
                discardBtn.dataset.ready = 'true';
                discardBtn.innerText = '⚠️ ¿Seguro? Toca de nuevo para descartar';
                setTimeout(() => {
                    discardBtn.dataset.ready = 'false';
                    discardBtn.innerText = '🛑 Descartar temporizador';
                }, 3000);
            }
        });
    }

    document.getElementById('close-judge').addEventListener('click', () => {
        judgeModal.classList.add('hidden');
        tempJudgeBlockId = null; 
    });

    document.querySelector('#audit-modal .modal-content').addEventListener('click', (e) => {
        const btn = e.target.closest('.opt-btn');
        if (btn && btn.dataset.type && btn.id !== 'close-config-btn' && btn.id !== 'plan-next-week-btn') {
            const type = btn.dataset.type;
            const label = schedulingItem ? schedulingItem.text : btn.innerText.trim();
            
            const state = LocalDB.load();
            const brokenRule = state.rules.find(r => r.label.toLowerCase() === label.toLowerCase() && r.decision === 'delete');
            
            if (brokenRule) {
                pendingGuardianData = { type: type, label: label, stack: stack };
                document.getElementById('guardian-message').innerHTML = `Prometiste <strong>ELIMINAR "${label}"</strong> en tu última revisión.<br><br>¿De verdad vas a romper tu propia regla?`;
                auditModal.classList.add('hidden');
                document.getElementById('guardian-modal').classList.remove('hidden');
                return; 
            }
            processBlockSave(type, label, stack);
        }
    });

    document.getElementById('guardian-cancel-btn').addEventListener('click', () => {
        document.getElementById('guardian-modal').classList.add('hidden');
        auditModal.classList.remove('hidden'); 
        pendingGuardianData = null;
    });

    document.getElementById('guardian-proceed-btn').addEventListener('click', () => {
        document.getElementById('guardian-modal').classList.add('hidden');
        if (pendingGuardianData) {
            processBlockSave(pendingGuardianData.type, pendingGuardianData.label, pendingGuardianData.stack);
            pendingGuardianData = null;
        }
    });

    durationSlider.addEventListener('input', (e) => { durationValue.innerText = `${e.target.value} min`; });

    document.getElementById('judge-duration-slider').addEventListener('input', (e) => {
        if (!tempJudgeBlockId) return;
        const newDur = parseInt(e.target.value);
        document.getElementById('judge-duration-value').innerText = `${newDur} min`;
        
        const state = LocalDB.load();
        const b = state.blocks.find(x => x.id === tempJudgeBlockId);
        if (b) {
            b.end = b.start + newDur;
            document.getElementById('judge-activity-time').innerText = `${TimeUtils.minutesToTime(b.start)} - ${TimeUtils.minutesToTime(b.end)}`;
            LocalDB.save(state);
            refreshView(stack); 
        }
    });

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
                let newEnd = newStart + duration;
                
                if(newStart < 0) { newStart = 0; newEnd = duration; }
                if(newEnd > 1440) { newEnd = 1440; newStart = 1440 - duration; }
                
                const dailyBlocks = state.blocks.filter(x => x.dateKey === b.dateKey && x.id !== b.id);
                
                let hasCollision = false;
                for (let other of dailyBlocks) {
                    if (newStart < other.end && newEnd > other.start) {
                        hasCollision = true;
                        break;
                    }
                }

                if (hasCollision) {
                    b.start = drag.originalStart;
                    b.end = drag.originalStart + duration;
                    
                    const toast = document.getElementById('collision-toast');
                    if(toast) {
                        toast.style.opacity = '1';
                        setTimeout(() => { toast.style.opacity = '0'; }, 3000);
                    }
                } else {
                    b.start = newStart;
                    b.end = newEnd;
                }
                
                LocalDB.save(state);
            }
            refreshView(stackComponent);
        } else {
            if(!schedulingItem) {
                tempJudgeBlockId = drag.id;
                const blockData = LocalDB.load().blocks.find(b => b.id === tempJudgeBlockId);
                if(blockData) {
                    document.getElementById('judge-activity-name').innerText = blockData.label;
                    document.getElementById('judge-activity-time').innerText = `${TimeUtils.minutesToTime(blockData.start)} - ${TimeUtils.minutesToTime(blockData.end)}`;
                    
                    const jSlider = document.getElementById('judge-duration-slider');
                    const jVal = document.getElementById('judge-duration-value');
                    const curDur = blockData.end - blockData.start;
                    
                    const stateObj = LocalDB.load();
                    const dailyBlocks = stateObj.blocks.filter(b => b.dateKey === blockData.dateKey).sort((a,b) => a.start - b.start);
                    const myIdx = dailyBlocks.findIndex(b => b.id === blockData.id);
                    let limit = 1440 - blockData.start; 
                    if (myIdx < dailyBlocks.length - 1) {
                        limit = dailyBlocks[myIdx + 1].start - blockData.start; 
                    }
                    
                    jSlider.max = limit.toString(); 
                    jSlider.value = curDur.toString();
                    jVal.innerText = `${curDur} min`;
                    
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
            const gapStart = Number(gapElement.dataset.start);
            const gapEnd = Number(gapElement.dataset.end);
            
            tempGapStart = gapStart;
            
            let maxAvailable = gapEnd - gapStart; 
            
            let duration = maxAvailable; 
            if (duration === 1440) duration = 60; 
            if (duration < 1) duration = 1;
            
            const timeString = TimeUtils.minutesToTime(tempGapStart);
            
            // LA CLAVE: Llamamos a la función que esconde explícitamente el botón
            openAuditForGap(timeString, duration, maxAvailable);
        }
    });

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