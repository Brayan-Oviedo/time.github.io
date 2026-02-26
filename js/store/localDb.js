const DB_KEY = '1440_OS_DATA';

const defaultState = {
    settings: {
        wakeUp: "06:00"
    },
    blocks: [],
    // Nuevo: Estado de la sesión activa (Cronómetro corriendo)
    currentSession: null 
};

export const LocalDB = {
    load() {
        const data = localStorage.getItem(DB_KEY);
        if (!data) return defaultState;
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error("Error leyendo DB", e);
            return defaultState;
        }
    },

    save(data) {
        localStorage.setItem(DB_KEY, JSON.stringify(data));
    },
    
    // Helpers para la sesión activa
    startSession(startTime) {
        const state = this.load();
        state.currentSession = { start: startTime };
        this.save(state);
    },

    stopSession() {
        const state = this.load();
        const session = state.currentSession;
        state.currentSession = null;
        this.save(state);
        return session;
    }
};