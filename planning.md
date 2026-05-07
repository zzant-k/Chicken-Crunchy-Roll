# Panduan Rekonstruksi Proyek Angkringan Admin (localStorage, Tanpa Backend)

Dokumen ini berisi **seluruh kode** yang diperlukan untuk membangun ulang proyek **Angkringan Admin Dashboard** tanpa Laravel dan tanpa database. Semua data disimpan di **localStorage** browser.

---

## 1. Struktur Folder

```
angkringan/
├── index.html              ← Halaman Login
├── pages/
│   ├── dashboard.html
│   ├── antrian.html
│   ├── menu.html
│   └── riwayat.html
├── css/
│   ├── main.css
│   ├── auth.css
│   ├── dashboard.css
│   ├── antrian.css
│   └── menu.css
└── js/
    ├── api.js              ← Data layer (localStorage)
    ├── auth.js             ← Login/logout
    ├── utils.js            ← Helper (toast, modal, format)
    ├── antrian.js          ← Logika antrian
    ├── menu.js             ← CRUD menu
    └── qris.js             ← QR Code generator
```

---

## 2. Credential Default

| Field | Value |
|---|---|
| Username | `aril` |
| Password | `ARIL007` |

> Data user disimpan otomatis ke localStorage saat pertama kali halaman dibuka.

---

## 3. Helper Functions Global (di dalam `api.js`)

```javascript
/** Ambil data dari localStorage (return array jika kosong) */
function getData(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

/** Simpan data ke localStorage */
function setData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}
```

---

## 4. File JavaScript

### `js/api.js` — Data Layer (localStorage)

Ini adalah file **inti** pengganti backend. Semua operasi CRUD dilakukan ke localStorage. Interface method-nya sama persis dengan versi backend agar file JS lain tidak perlu diubah.

```javascript
/**
 * api.js — Data layer menggunakan localStorage (tanpa backend)
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
            { id: 1, username: 'admin', password: 'admin123' }
        ]);
    }
    if (!localStorage.getItem('angkringan_menus'))      setData('angkringan_menus', []);
    if (!localStorage.getItem('angkringan_antrians'))    setData('angkringan_antrians', []);
    if (!localStorage.getItem('angkringan_transaksis'))  setData('angkringan_transaksis', []);
}
seedDefaults();

/* ============================
   STORAGE KEYS
   ============================ */
const KEYS = {
    users:      'angkringan_users',
    menus:      'angkringan_menus',
    antrians:   'angkringan_antrians',
    transaksis: 'angkringan_transaksis',
};

/* ============================
   API OBJECT
   ============================ */
const api = {

    // -------- AUTH --------
    login(body) {
        return new Promise((resolve, reject) => {
            const users = getData(KEYS.users);
            const user = users.find(u =>
                u.username === body.username && u.password === body.password
            );
            if (!user) { reject(new Error('Username atau password salah.')); return; }
            const token = 'local_' + Date.now();
            resolve({ token, user: { id: user.id, username: user.username }, message: 'Login berhasil.' });
        });
    },

    logout() { return Promise.resolve({ message: 'Logout berhasil.' }); },
    me()     { return Promise.resolve({ id: 1, username: 'admin' }); },

    // -------- MENU (CRUD) --------
    getMenu() {
        const menus = getData(KEYS.menus);
        menus.sort((a, b) => (a.kategori + a.nama).localeCompare(b.kategori + b.nama));
        return Promise.resolve(menus);
    },

    createMenu(body) {
        const menus = getData(KEYS.menus);
        const newMenu = {
            id: nextId(KEYS.menus),
            nama: body.nama,
            harga: parseFloat(body.harga),
            kategori: body.kategori,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        menus.push(newMenu);   // ← INSERT = push ke array
        setData(KEYS.menus, menus);
        return Promise.resolve(newMenu);
    },

    updateMenu(id, body) {
        const menus = getData(KEYS.menus);
        const idx = menus.findIndex(m => m.id === parseInt(id));
        if (idx === -1) return Promise.reject(new Error('Menu tidak ditemukan.'));
        menus[idx] = { ...menus[idx], ...body, harga: parseFloat(body.harga), updated_at: new Date().toISOString() };
        setData(KEYS.menus, menus);   // ← UPDATE = ubah lalu simpan ulang
        return Promise.resolve(menus[idx]);
    },

    deleteMenu(id) {
        let menus = getData(KEYS.menus);
        menus = menus.filter(m => m.id !== parseInt(id));   // ← DELETE = filter lalu simpan ulang
        setData(KEYS.menus, menus);
        return Promise.resolve({ message: 'Menu dihapus.' });
    },

    // -------- ANTRIAN --------
    getAntrian() {
        const antrians = getData(KEYS.antrians).filter(a => a.status === 'aktif');
        antrians.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        return Promise.resolve(antrians);   // ← SELECT = ambil dari localStorage
    },

    createAntrian(body) {
        const antrians = getData(KEYS.antrians);
        const menus = getData(KEYS.menus);
        const today = todayStr();
        const todayCount = antrians.filter(a => (a.created_at || '').startsWith(today)).length;

        const antrianMenus = body.menus.map(item => {
            const m = menus.find(x => x.id === item.menu_id);
            return { id: item.menu_id, nama: m?.nama || 'Unknown', harga: m?.harga || 0, kategori: m?.kategori || '', jumlah: item.jumlah };
        });
        const total = antrianMenus.reduce((s, m) => s + m.harga * m.jumlah, 0);

        const newAntrian = {
            id: nextId(KEYS.antrians),
            nama_pelanggan: body.nama_pelanggan,
            nomor_antrian: todayCount + 1,
            status: 'aktif',
            menus: antrianMenus,
            total,
            created_at: new Date().toISOString(),
        };

        antrians.push(newAntrian);
        setData(KEYS.antrians, antrians);
        return Promise.resolve(newAntrian);
    },

    deleteAntrian(id) {
        const antrians = getData(KEYS.antrians);
        const antrian = antrians.find(a => a.id === parseInt(id));
        if (!antrian) return Promise.reject(new Error('Antrian tidak ditemukan.'));

        // Buat transaksi otomatis
        const transaksis = getData(KEYS.transaksis);
        if (!transaksis.some(t => t.antrian_id === antrian.id)) {
            transaksis.push({
                id: nextId(KEYS.transaksis),
                antrian_id: antrian.id, total: antrian.total, bayar_via: 'Manual',
                created_at: new Date().toISOString(),
                antrian: {
                    nama_pelanggan: antrian.nama_pelanggan,
                    nomor_antrian: antrian.nomor_antrian,
                    menus: antrian.menus.map(m => ({ id: m.id, nama: m.nama, harga: m.harga, pivot: { jumlah: m.jumlah } })),
                },
            });
            setData(KEYS.transaksis, transaksis);
        }
        antrian.status = 'selesai';
        setData(KEYS.antrians, antrians);
        return Promise.resolve({ message: 'Antrian diselesaikan.' });
    },

    // -------- TRANSAKSI --------
    getTransaksi() {
        const today = todayStr();
        const transaksis = getData(KEYS.transaksis)
            .filter(t => (t.created_at || '').startsWith(today))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 50);
        return Promise.resolve(transaksis);
    },

    createTransaksi(body) {
        const transaksis = getData(KEYS.transaksis);
        const antrians = getData(KEYS.antrians);
        const antrian = antrians.find(a => a.id === parseInt(body.antrian_id));

        if (transaksis.some(t => t.antrian_id === parseInt(body.antrian_id))) {
            return Promise.reject(new Error('Transaksi sudah ada untuk antrian ini.'));
        }

        transaksis.push({
            id: nextId(KEYS.transaksis),
            antrian_id: parseInt(body.antrian_id),
            total: parseFloat(body.total),
            bayar_via: body.bayar_via || 'QRIS',
            created_at: new Date().toISOString(),
            antrian: antrian ? {
                nama_pelanggan: antrian.nama_pelanggan,
                nomor_antrian: antrian.nomor_antrian,
                menus: antrian.menus.map(m => ({ id: m.id, nama: m.nama, harga: m.harga, pivot: { jumlah: m.jumlah } })),
            } : null,
        });
        setData(KEYS.transaksis, transaksis);

        if (antrian) { antrian.status = 'selesai'; setData(KEYS.antrians, antrians); }
        return Promise.resolve({ message: 'Transaksi disimpan.' });
    },

    getSummary() {
        const today = todayStr();
        const transaksis = getData(KEYS.transaksis).filter(t => (t.created_at || '').startsWith(today));
        const antrians = getData(KEYS.antrians).filter(a => a.status === 'aktif');
        const menus = getData(KEYS.menus);
        return Promise.resolve({
            total_transaksi_hari_ini: transaksis.reduce((s, t) => s + parseFloat(t.total), 0),
            jumlah_transaksi: transaksis.length,
            antrian_aktif: antrians.length,
            total_menu: menus.length,
        });
    },

    exportPdf(filename) {
        const today = todayStr();
        const transaksis = getData(KEYS.transaksis).filter(t => (t.created_at || '').startsWith(today));
        const totalPendapatan = transaksis.reduce((s, t) => s + parseFloat(t.total), 0);

        const rows = transaksis.map((t, i) => {
            const a = t.antrian || {};
            const menuList = (a.menus || []).map(m =>
                `<li>${m.nama} (x${m.pivot?.jumlah || 1}) - Rp ${(m.harga * (m.pivot?.jumlah || 1)).toLocaleString('id-ID')}</li>`
            ).join('');
            return `<tr>
                <td>${i + 1}</td>
                <td>${new Date(t.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                <td>${a.nama_pelanggan || '-'}</td>
                <td><ul style="margin:0;padding-left:15px;font-size:11px">${menuList || '-'}</ul></td>
                <td style="text-align:right">Rp ${parseFloat(t.total).toLocaleString('id-ID')}</td>
            </tr>`;
        }).join('');

        const html = `<!DOCTYPE html><html><head><title>Laporan Harian</title>
        <style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px}
        h1{font-size:18px;text-align:center}p.sub{text-align:center;color:#666}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        th,td{border:1px solid #ddd;padding:6px;text-align:left;vertical-align:top}
        th{background:#f3f4f6;font-weight:bold}
        .footer{margin-top:24px;text-align:center;font-size:10px;color:#999}</style></head>
        <body><h1>Laporan Harian Angkringan</h1>
        <p class="sub">Tanggal: ${new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })}</p>
        <p><strong>Total Pendapatan:</strong> Rp ${totalPendapatan.toLocaleString('id-ID')} | <strong>Jumlah Transaksi:</strong> ${transaksis.length}</p>
        <table><thead><tr><th>No</th><th>Waktu</th><th>Pelanggan</th><th>Pesanan</th><th>Total</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" style="text-align:center">Tidak ada transaksi</td></tr>'}</tbody></table>
        <div class="footer">Dicetak: ${new Date().toLocaleString('id-ID')}</div>
        <script>window.print()<\/script></body></html>`;

        const blob = new Blob([html], { type: 'text/html' });
        window.open(URL.createObjectURL(blob), '_blank');
        return Promise.resolve();
    },
};

export default api;
```

**Penjelasan penting:**
- Semua method mengembalikan `Promise` agar kompatibel dengan kode yang sudah ada (`await api.getMenu()`).
- `seedDefaults()` otomatis dipanggil saat file di-load — membuat user admin & key kosong jika belum ada.
- `exportPdf()` membuat HTML laporan lalu membukanya di tab baru dengan `window.print()`.

---

### `js/auth.js` — Login & Logout

```javascript
import api from './api.js';

const TOKEN_KEY = 'angkringan_token';
const USER_KEY  = 'angkringan_user';

export async function login(username, password) {
    const data = await api.login({ username, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data;
}

export async function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = '/frontend/index.html';
}

export function requireAuth() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { window.location.href = '/frontend/index.html'; return false; }
    return true;
}

export function redirectIfAuth() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) { window.location.href = '/frontend/pages/dashboard.html'; return true; }
    return false;
}

export function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); }
    catch { return null; }
}
```

> **Catatan:** Sesuaikan path redirect (`/frontend/...`) dengan lokasi folder Anda di web server.

---

### `js/utils.js` — Helper (Tidak berubah)

```javascript
export function formatRupiah(n) {
    return 'Rp ' + Number(n).toLocaleString('id-ID');
}

export function escHtml(str) {
    return String(str).replace(/[&<>"']/g, c =>
        ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

export function formatTime(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export function showToast(msg, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const icons = {
        success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>`,
        error:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
        info:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>`,
    };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `${icons[type] || icons.info} <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0'; toast.style.transform = 'translateY(8px)'; toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

export function openModal(id) {
    const o = document.getElementById(id + '-overlay');
    if (o) o.classList.add('open');
}

export function closeModal(id) {
    const o = document.getElementById(id + '-overlay');
    if (o) o.classList.remove('open');
}
```

---

### `js/antrian.js` — Logika Antrian (Tidak berubah)

File ini **tidak perlu diubah** karena menggunakan `import api from './api.js'`. Selama interface `api.*` sama (dan memang sama), file ini langsung kompatibel dengan localStorage.

Salin langsung dari proyek asli. Fungsi yang di-export:
- `loadAntrian()` — mengambil antrian aktif dari `api.getAntrian()` lalu render
- `loadMenuForForm()` — mengambil daftar menu untuk form tambah antrian
- `openAddAntrianModal()`, `submitAntrian()`, `konfirmasiPembayaran()`

---

### `js/menu.js` — CRUD Menu (Tidak berubah)

Sama seperti antrian.js, file ini **langsung kompatibel** karena menggunakan interface `api.*` yang sama.

Salin langsung dari proyek asli. Fungsi yang di-export:
- `loadMenus()`, `filterMenus(kategori)`, `openAddModal()`, `saveMenu()`

---

### `js/qris.js` — QR Code Generator (Tidak berubah)

```javascript
export function generateQR(total) {
    const container = document.getElementById('qr-code');
    if (!container) return;
    container.innerHTML = '';
    const payload = `QRIS.ID|ANGKRINGAN.KU|TOTAL:${Math.round(total)}|${Date.now()}`;
    if (typeof QRCode === 'undefined') {
        container.innerHTML = '<p style="color:var(--color-text-muted);font-size:12px;">QR Code tidak tersedia.</p>';
        return;
    }
    new QRCode(container, { text: payload, width: 200, height: 200, colorDark: '#000', colorLight: '#fff', correctLevel: QRCode.CorrectLevel.M });
}
```

---

## 5. Perubahan di HTML

### Yang Harus Diubah di Setiap File HTML

**1. Hapus `@vite(...)` → ganti dengan `<link>` biasa:**
```html
<!-- HAPUS ini: -->
@vite(['resources/css/main.css', 'resources/css/auth.css'])

<!-- GANTI menjadi: -->
<link rel="stylesheet" href="css/main.css">
<link rel="stylesheet" href="css/auth.css">
<!-- (untuk halaman di pages/ gunakan ../css/main.css) -->
```

**2. Hapus `@vite(['resources/js/...'])` → import langsung di `<script type="module">`:**
```html
<!-- HAPUS ini: -->
@vite(['resources/js/auth.js'])
<script type="module">
    auth.requireAuth();
</script>

<!-- GANTI menjadi: -->
<script type="module">
    import { requireAuth } from '../js/auth.js';
    if (!requireAuth()) throw new Error('Not authenticated');
</script>
```

**3. Ubah href navigasi dari rute Laravel ke file `.html`:**
```html
<!-- HAPUS: href="/dashboard" -->
<a href="dashboard.html">Dashboard</a>

<!-- Dari halaman pages/ ke halaman lain di pages/: -->
<a href="antrian.html">Antrian</a>
```

**4. Redirect di `index.html` (login):**
```javascript
// Setelah login berhasil:
window.location.href = 'pages/dashboard.html';
```

---

## 6. File CSS

File CSS **tidak perlu diubah sama sekali**. Salin langsung dari proyek asli:

| Dari (proyek lama) | Ke (proyek baru) |
|---|---|
| `resources/css/main.css` | `css/main.css` |
| `resources/css/auth.css` | `css/auth.css` |
| `resources/css/dashboard.css` | `css/dashboard.css` |
| `resources/css/antrian.css` | `css/antrian.css` |
| `resources/css/menu.css` | `css/menu.css` |

---

## 7. Mapping Operasi Database → localStorage

| Operasi SQL | Kode localStorage |
|---|---|
| `INSERT INTO menus ...` | `menus.push(newItem); setData(key, menus)` |
| `SELECT * FROM menus` | `getData(key)` → langsung dapat array |
| `UPDATE menus SET ... WHERE id=?` | `menus[idx] = {...}; setData(key, menus)` |
| `DELETE FROM menus WHERE id=?` | `menus = menus.filter(m => m.id !== id); setData(key, menus)` |
| `SELECT COUNT(*) FROM ...` | `getData(key).length` |
| `SELECT SUM(total) FROM ...` | `getData(key).reduce((s,t) => s + t.total, 0)` |

---

## 8. Struktur Data di localStorage

### Key: `angkringan_menus`
```json
[
  { "id": 1, "nama": "Nasi Goreng", "harga": 12000, "kategori": "makanan" },
  { "id": 2, "nama": "Es Teh", "harga": 5000, "kategori": "minuman" }
]
```

### Key: `angkringan_antrians`
```json
[
  {
    "id": 1, "nama_pelanggan": "Budi", "nomor_antrian": 1,
    "status": "aktif",
    "menus": [{ "id": 1, "nama": "Nasi Goreng", "harga": 12000, "jumlah": 2 }],
    "total": 24000,
    "created_at": "2026-04-27T12:00:00.000Z"
  }
]
```

### Key: `angkringan_transaksis`
```json
[
  {
    "id": 1, "antrian_id": 1, "total": 24000, "bayar_via": "QRIS",
    "created_at": "2026-04-27T12:05:00.000Z",
    "antrian": { "nama_pelanggan": "Budi", "nomor_antrian": 1, "menus": [...] }
  }
]
```

### Key: `angkringan_users`
```json
[{ "id": 1, "username": "admin", "password": "admin123" }]
```

---

## 9. Sistem Antrian (FIFO)

Antrian diurutkan berdasarkan `created_at` ascending (paling lama → paling awal dilayani). Saat diselesaikan (`deleteAntrian`):

1. Hitung total harga dari menu yang dipesan
2. Buat record transaksi otomatis
3. Ubah `status` dari `aktif` → `selesai`
4. Data yang tampil di halaman hanya yang `status === 'aktif'`

---

## 10. Checklist Rekonstruksi

- [ ] Buat struktur folder sesuai Bagian 1
- [ ] Salin semua file CSS dari proyek lama (lihat Bagian 6)
- [ ] Buat `js/api.js` → salin kode dari Bagian 4
- [ ] Buat `js/auth.js` → salin kode dari Bagian 4
- [ ] Buat `js/utils.js` → salin kode dari Bagian 4
- [ ] Salin `js/antrian.js` dari proyek lama (tidak perlu diubah)
- [ ] Salin `js/menu.js` dari proyek lama (tidak perlu diubah)
- [ ] Salin `js/qris.js` dari proyek lama (tidak perlu diubah)
- [ ] Salin semua file HTML dan terapkan perubahan di Bagian 5:
  - [ ] Hapus `@vite(...)` → ganti `<link>` biasa
  - [ ] Hapus `@vite` JS → gunakan `import` di `<script type="module">`
  - [ ] Ubah href navigasi dari `/route` → `file.html`
- [ ] Buka via web server (Laragon/XAMPP), bukan double-click file
- [ ] Tes login dengan admin/admin123
- [ ] Tes CRUD menu, antrian, transaksi
- [ ] Tes ekspor PDF (cetak via browser)

---

> **PENTING:** File HTML harus diakses melalui web server (http://localhost/...), bukan langsung buka file (file://...), karena ES Modules (`type="module"`) tidak berjalan di protokol `file://`.
