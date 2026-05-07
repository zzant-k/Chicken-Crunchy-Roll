/**
 * api.js — Data layer menggunakan LocalStorage
 */

const DB_KEY_MENU = 'angkringan_menus';
const DB_KEY_QUEUE = 'angkringan_queues';
const DB_KEY_HISTORY = 'angkringan_history';

// Default Data (Seed)
const INITIAL_MENUS = [
    { id: 1, nama: 'Chicken Crunchy Roll', harga: 15000, kategori: 'makanan' }
];

const api = {
    // === MENU ===
    getMenu: async () => {
        let menus = JSON.parse(localStorage.getItem(DB_KEY_MENU));
        if (!menus) {
            menus = INITIAL_MENUS;
            localStorage.setItem(DB_KEY_MENU, JSON.stringify(menus));
        }
        return menus;
    },

    createMenu: async (data) => {
        const menus = await api.getMenu();
        const newMenu = { id: Date.now(), ...data };
        menus.push(newMenu);
        localStorage.setItem(DB_KEY_MENU, JSON.stringify(menus));
        return newMenu;
    },

    updateMenu: async (id, data) => {
        const menus = await api.getMenu();
        const idx = menus.findIndex(m => m.id === id);
        if (idx !== -1) {
            menus[idx] = { ...menus[idx], ...data };
            localStorage.setItem(DB_KEY_MENU, JSON.stringify(menus));
        }
    },

    deleteMenu: async (id) => {
        const menus = await api.getMenu();
        const filtered = menus.filter(m => m.id !== id);
        localStorage.setItem(DB_KEY_MENU, JSON.stringify(filtered));
    },

    // === QUEUE / ANTRIAN ===
    getQueues: async () => {
        return JSON.parse(localStorage.getItem(DB_KEY_QUEUE)) || [];
    },

    addQueue: async (data) => {
        const queues = await api.getQueues();
        const newOrder = {
            id: Date.now(),
            noAntrian: queues.length > 0 ? Math.max(...queues.map(q => q.noAntrian)) + 1 : 1,
            status: 'menunggu',
            waktu: new Date().toISOString(),
            ...data
        };
        queues.push(newOrder);
        localStorage.setItem(DB_KEY_QUEUE, JSON.stringify(queues));
        return newOrder;
    },

    updateQueueStatus: async (id, status) => {
        const queues = await api.getQueues();
        const idx = queues.findIndex(q => q.id === id);
        if (idx !== -1) {
            queues[idx].status = status;
            localStorage.setItem(DB_KEY_QUEUE, JSON.stringify(queues));
            if (status === 'selesai') await api.addToHistory(queues[idx]);
        }
    },

    deleteQueue: async (id) => {
        const queues = await api.getQueues();
        const filtered = queues.filter(q => q.id !== id);
        localStorage.setItem(DB_KEY_QUEUE, JSON.stringify(filtered));
    },

    // === HISTORY ===
    getHistory: async () => {
        return JSON.parse(localStorage.getItem(DB_KEY_HISTORY)) || [];
    },

    addToHistory: async (order) => {
        const history = await api.getHistory();
        history.push({ ...order, completedAt: new Date().toISOString() });
        localStorage.setItem(DB_KEY_HISTORY, JSON.stringify(history));
    }
};

export default api;
