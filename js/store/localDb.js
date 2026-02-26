const DB_KEY = '1440_OS_DATA';

const defaultState = {
    settings: { wakeUp: "06:00" },
    blocks: [],
    inbox: [], 
    rules: [],
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
            
            // FILTRO ANTI-DUPLICADOS PARA REGLAS VIEJAS
            if (!parsed.rules) {
                parsed.rules = [];
            } else {
                const uniqueRules = [];
                const seenLabels = new Set();
                // Recorremos al revés para quedarnos con la decisión más reciente
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
    
    // --- MÓDULO JUEZ ---
    updateBlockDecision(blockId, decision) {
        const state = this.load();
        const block = state.blocks.find(b => b.id === blockId);
        if (block) { block.decision = decision; this.save(state); }
    },
    
    // NUEVO: Agrega regla solo si no existe, o la actualiza si cambió de opinión
    addSystemRule(activityLabel, decision) {
        const state = this.load();
        const labelLower = activityLabel.toLowerCase().trim();
        
        const existingIndex = state.rules.findIndex(r => r.label.toLowerCase().trim() === labelLower);
        
        if (existingIndex !== -1) {
            // Actualiza la decisión existente (No duplica)
            state.rules[existingIndex].decision = decision;
            state.rules[existingIndex].date = new Date().toISOString();
        } else {
            // Crea una nueva regla
            state.rules.push({ 
                id: Date.now(), 
                label: activityLabel.trim(), 
                decision: decision, 
                date: new Date().toISOString() 
            });
        }
        this.save(state);
    },
    
    // --- MÓDULO INBOX ---
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