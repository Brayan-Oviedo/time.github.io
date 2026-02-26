export const TimeUtils = {
    // Convierte "08:30" a minutos totales (510)
    timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return (hours * 60) + minutes;
    },

    // Convierte minutos (510) a "08:30"
    minutesToTime(totalMinutes) {
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    },

    // Obtiene los minutos del día actual
    getCurrentDayMinutes() {
        const now = new Date();
        return (now.getHours() * 60) + now.getMinutes();
    },

    // --- NUEVAS FUNCIONES DE FECHA ---
    
    // Genera una clave única por día (ej: "2024-05-20")
    // Usamos esto para filtrar los bloques de cada día
    getDateKey(date) {
        return date.toISOString().split('T')[0];
    },

    // Devuelve una fecha legible (ej: "20 FEB")
    getDisplayDate(date) {
        return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).toUpperCase();
    },

    isToday(date) {
        const today = new Date();
        return this.getDateKey(date) === this.getDateKey(today);
    }
};