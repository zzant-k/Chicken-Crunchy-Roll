/**
 * api.js — Data layer menggunakan LocalStorage
 */

/* ============================
   HELPER FUNCTIONS
   ============================ */
function getData(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function setData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function nextId(key) {
    const items = getData(key);
    if (items.length === 0) return 1;
    return Math.max(...items.map(i => i.id)) + 1;
}

function todayStr() {
    return new Date().toISOString().split('T')[0];
}

/* ============================
   SEED DATA DEFAULT
   ============================ */
function seedDefaults() {
    if (!localStorage.getItem('angkringan_users')) {
        setData('angkringan_users', [
            { id: 1, username: 'aril', password: 'ARIL007' }
        ]);
    }
    if (!localStorage.getItem('angkringan_menus')) {
        setData('angkringan_menus', [
            { id: 1, nama: 'Chicken Crunchy Roll', harga: 15000, kategori: 'makanan' }
        ]);
    }
}
seedDefaults();

/* ============================
   STORAGE KEYS
   ============================ */
const DB_KEY_MENU    = 'angkringan_menus';
const DB_KEY_QUEUE   = 'angkringan_queues';
const DB_KEY_HISTORY = 'angkringan_history';
const DB_KEY_USERS   = 'angkringan_users';

const api = {

    // === AUTH ===
    login(body) {
        return new Promise((resolve, reject) => {
            const users = getData(DB_KEY_USERS);
            const user = users.find(u =>
                u.username === body.username && u.password === body.password
            );
            if (!user) { reject(new Error('Username atau password salah.')); return; }
            const token = 'local_' + Date.now();
            resolve({ token, user: { id: user.id, username: user.username }, message: 'Login berhasil.' });
        });
    },

    // === MENU ===
    getMenu: async () => {
        let menus = JSON.parse(localStorage.getItem(DB_KEY_MENU));
        if (!menus) {
            menus = [{ id: 1, nama: 'Chicken Crunchy Roll', harga: 15000, kategori: 'makanan' }];
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
