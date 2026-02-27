const DB_KEY = '1440_OS_DATA';

const defaultState = {
    settings: { wakeUp: "06:00" },
    blocks: [],
    inbox: [], 
    rules: [],
    routines: [],
    currentSession: null,
    viewDate: new Date().toDateString() 
};

export const LocalDB = {
    load() {
        const data = localStorage.getItem(DB_KEY);
        if (!data) return defaultState;
        try {
            const parsed = JSON.parse(data);
            if (!parsed.inbox) parsed.inbox = [];
            if (!parsed.viewDate) parsed.viewDate = new Date().toDateString();
            if (!parsed.routines) parsed.routines = [];
            
            if (!parsed.rules) {
                parsed.rules = [];
            } else {
                const uniqueRules = [];
                const seenLabels = new Set();
                for (let i = parsed.rules.length - 1; i >= 0; i--) {
                    const rule = parsed.rules[i];
                    const labelLower = rule.label.toLowerCase().trim();
                    if (!seenLabels.has(labelLower)) {
                        seenLabels.add(labelLower);
                        uniqueRules.unshift(rule); 
                    }
                }
                parsed.rules = uniqueRules;
            }
            return parsed;
        } catch (e) {
            return defaultState;
        }
    },
    
    save(data) { localStorage.setItem(DB_KEY, JSON.stringify(data)); },
    startSession(startTime) { const state = this.load(); state.currentSession = { start: startTime }; this.save(state); },
    stopSession() { const state = this.load(); const session = state.currentSession; state.currentSession = null; this.save(state); return session; },
    
    updateBlockDecision(blockId, decision) {
        const state = this.load();
        const block = state.blocks.find(b => b.id === blockId);
        if (block) { block.decision = decision; this.save(state); }
    },
    
    addSystemRule(activityLabel, decision) {
        const state = this.load();
        const labelLower = activityLabel.toLowerCase().trim();
        const existingIndex = state.rules.findIndex(r => r.label.toLowerCase().trim() === labelLower);
        
        if (existingIndex !== -1) {
            state.rules[existingIndex].decision = decision;
            state.rules[existingIndex].date = new Date().toISOString();
        } else {
            state.rules.push({ 
                id: Date.now(), 
                label: activityLabel.trim(), 
                decision: decision, 
                date: new Date().toISOString() 
            });
        }
        this.save(state);
    },

    // NUEVO: Permite quitar una regla para que el bloque quede virgen
    removeSystemRule(activityLabel) {
        const state = this.load();
        if(!state.rules) return;
        const labelLower = activityLabel.toLowerCase().trim();
        state.rules = state.rules.filter(r => r.label.toLowerCase().trim() !== labelLower);
        this.save(state);
    },

    addRoutine(block) {
        const state = this.load();
        const exists = state.routines.find(r => r.label === block.label && r.start === block.start);
        if (!exists) {
            state.routines.push({
                start: block.start,
                end: block.end,
                label: block.label,
                type: block.type
            });
            this.save(state);
        }
    },

    // CORREGIDO: Aniquila la rutina SOLO del futuro
    removeRoutine(block) {
        const state = this.load();
        if (!state.routines) return;
        
        // 1. La quitamos de la memoria permanente
        state.routines = state.routines.filter(r => !(r.label === block.label && r.start === block.start));

        // 2. Destruimos los bloques generados SOLO si la fecha es MAYOR (mañana en adelante)
        state.blocks = state.blocks.filter(b => {
            const isMatch = (b.label === block.label && b.start === block.start && b.decision === 'routine');
            if (isMatch && b.dateKey > block.dateKey) {
                return false; 
            }
            return true; 
        });

        this.save(state);
    },

    applyRoutines(dateKey) {
        const state = this.load();
        let added = false;
        state.routines.forEach(routine => {
            const exists = state.blocks.find(b => b.dateKey === dateKey && b.start === routine.start && b.label === routine.label);
            if (!exists) {
                state.blocks.push({
                    id: Date.now() + Math.random(),
                    start: routine.start,
                    end: routine.end,
                    label: routine.label,
                    type: routine.type,
                    dateKey: dateKey,
                    decision: 'routine' 
                });
                added = true;
            }
        });
        if (added) this.save(state);
        return added;
    },
    
    addInboxItem(text) {
        const state = this.load();
        state.inbox.push({ id: Date.now(), text: text });
        this.save(state);
    },
    removeInboxItem(id) {
        const state = this.load();
        state.inbox = state.inbox.filter(item => item.id !== id);
        this.save(state);
    }
};