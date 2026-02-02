/**
 * Storage Utility
 * Encapsulates LocalStorage operations with error handling.
 */
export const Storage = {
    /**
     * Safely parse JSON from storage
     * @param {string} str - JSON string
     * @param {any} fallback - Fallback value
     * @returns {any}
     */
    safeParse(str, fallback) {
        try {
            return str ? JSON.parse(str) : fallback;
        } catch (e) {
            console.error('Storage Parse Error:', e);
            return fallback;
        }
    },

    get(key, fallback = null) {
        const item = localStorage.getItem(key);
        return this.safeParse(item, fallback);
    },

    set(key, value) {
        try {
            const str = typeof value === 'string' ? value : JSON.stringify(value);
            localStorage.setItem(key, str);
        } catch (e) {
            console.error('Storage Set Error:', e);
        }
    },

    remove(key) {
        localStorage.removeItem(key);
    }
};

export const SessionKeys = {
    LIST: 'mathSolverSessions',
    CURRENT_ID: 'mathSolverCurrentSession',
    PANEL_POS: 'mathSolver_panelPos'
};
