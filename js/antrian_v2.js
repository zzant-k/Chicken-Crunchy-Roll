/**
 * antrian.js — Antrian management + cart system dengan multi-item & multi-topping
 */
import api from './api.js';
import LaporanManager from './laporan.js';
import { showToast, formatRupiah, escHtml, formatTime, openModal, closeModal } from './utils.js';

let antrianList  = [];
let menuList     = [];
let cart         = []; // Array of { cartId, menuId, nama, harga, variantName, jumlah }
let currentAntrianForPayment = null;

// Sinkron harga dari localStorage (diisi oleh menu.js)
const CRUNCHY_PRICES_KEY = 'crunchy_prices';

function getCrunchyPrices() {
    const DEFAULT = {
        regular: {
            'Original': 15000, 'Filling': 17000, 'Saus Celup': 17000,
            'Bumbu Tabur': 17000, 'Filling + Saus Celup': 22000, 'Filling + Bumbu Tabur': 20000
        },
        large: {
            'Original': 23000, 'Filling': 25000, 'Saus Celup': 25000,
            'Bumbu Tabur': 25000, 'Filling + Saus Celup': 30000, 'Filling + Bumbu Tabur': 28000
        }
    };
    try {
        const saved = JSON.parse(localStorage.getItem(CRUNCHY_PRICES_KEY));
        if (!saved) return DEFAULT;
        const toObj = (arr) => arr.reduce((o, v) => ({ ...o, [v.varian]: v.harga }), {});
        return {
            regular: Array.isArray(saved.regular) ? toObj(saved.regular) : saved.regular,
            large:   Array.isArray(saved.large)   ? toObj(saved.large)   : saved.large,
        };
    } catch { return DEFAULT; }
}

function calculateCrunchyPrice(menuId) {
    const ukuran = document.querySelector(`input[name="ukuran-${menuId}"]:checked`)?.value || 'Regular';
    const varian = document.querySelector(`input[name="varian-${menuId}"]:checked`)?.value || 'Original';
    const prices = getCrunchyPrices();
    return prices[ukuran.toLowerCase()]?.[varian] || 15000;
}

function getCrunchyVariantName(menuId) {
    const ukuran = document.querySelector(`input[name="ukuran-${menuId}"]:checked`)?.value || 'Regular';
    const varian = document.querySelector(`input[name="varian-${menuId}"]:checked`)?.value || 'Original';
    let name = `${ukuran} · ${varian}`;
    if (varian.includes('Filling')) name += ` (${document.getElementById(`select-filling-${menuId}`)?.value || ''})`;
    if (varian.includes('Saus'))    name += ` (${document.getElementById(`select-saus-${menuId}`)?.value || ''})`;
    if (varian.includes('Bumbu'))   name += ` (${document.getElementById(`select-bumbu-${menuId}`)?.value || ''})`;
    return name;
}

function updateVariantUI(menuId) {
    const varian = document.querySelector(`input[name="varian-${menuId}"]:checked`)?.value || '';
    document.getElementById(`group-filling-${menuId}`)?.classList.toggle('hidden', !varian.includes('Filling'));
    document.getElementById(`group-saus-${menuId}`)?.classList.toggle('hidden', !varian.includes('Saus'));
    document.getElementById(`group-bumbu-${menuId}`)?.classList.toggle('hidden', !varian.includes('Bumbu'));

    // Update harga preview
    const isCrunchy = document.querySelector(`[data-id="${menuId}"]`)?.dataset?.nama?.toLowerCase().includes('chicken crunchy');
    if (isCrunchy) {
        const price = calculateCrunchyPrice(menuId);
        const el = document.getElementById(`display-price-${menuId}`);
        if (el) el.textContent = formatRupiah(price);
    }
}

/* =========================================================
   Load & Render Antrian
   ========================================================= */
export async function loadAntrian() {
    const all = await api.getQueues();
    antrianList = all.filter(q => q.status !== 'selesai');
    renderAntrian();
    return antrianList;
}

function renderAntrian() {
    const container = document.getElementById('antrian-list');
    if (!container) return;

    if (antrianList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
                <p>Belum ada antrian aktif saat ini.</p>
            </div>`;
        return;
    }

    container.innerHTML = antrianList.map(a => antrianCardHTML(a)).join('');

    container.querySelectorAll('.btn-bayar').forEach(btn =>
        btn.addEventListener('click', () => openPaymentModal(parseInt(btn.dataset.id))));
    container.querySelectorAll('.btn-tunai').forEach(btn =>
        btn.addEventListener('click', () => bayarTunai(parseInt(btn.dataset.id))));
    container.querySelectorAll('.btn-batal').forEach(btn =>
        btn.addEventListener('click', () => batalkanAntrian(parseInt(btn.dataset.id))));
}

function antrianCardHTML(antrian) {
    const menuItems = antrian.menus.map(m => `
        <div class="order-item">
            <span class="order-item-name">
                <span class="order-qty">x${m.jumlah}</span>
                ${escHtml(m.nama)}${m.variantName ? ` <span style="color:var(--color-text-dim);font-size:10px;">[${escHtml(m.variantName)}]</span>` : ''}
            </span>
            <span class="order-item-price">${formatRupiah(m.harga * m.jumlah)}</span>
        </div>`).join('');

    return `
        <div class="antrian-card" id="antrian-${antrian.id}">
            <div class="antrian-card-header">
                <div class="queue-number">${antrian.noAntrian}</div>
                <div class="customer-info">
                    <div class="customer-name">${escHtml(antrian.nama_pelanggan)}</div>
                    <div class="customer-time">${antrian.menus.length} item &mdash; ${formatTime(antrian.waktu)}</div>
                </div>
            </div>
            <div class="antrian-card-body">
                <div class="order-items">${menuItems}</div>
                <div class="antrian-total-row">
                    <span class="antrian-total-label">Total</span>
                    <span class="antrian-total-value rupiah">${formatRupiah(antrian.total)}</span>
                </div>
            </div>
            <div class="antrian-card-footer">
                <button class="btn btn-success btn-sm flex-1 btn-bayar" data-id="${antrian.id}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                    QRIS
                </button>
                <button class="btn btn-primary btn-sm flex-1 btn-tunai" data-id="${antrian.id}">Tunai</button>
                <button class="btn btn-danger btn-sm btn-batal" data-id="${antrian.id}" title="Batal" style="padding: 0 8px; min-width: auto; font-size: 10px; font-weight: 700;">
                    BATAL
                </button>
            </div>
        </div>`;
}

/* =========================================================
   Load Menu untuk form (card-based picker)
   ========================================================= */
export async function loadMenuForForm() {
    menuList = await api.getMenu();
    renderMenuPicker();
}

function renderMenuPicker() {
    const container = document.getElementById('menu-select-group');
    if (!container) return;

    container.innerHTML = menuList.map(m => menuPickerHTML(m)).join('');

    // Bind radio & select changes → update price preview
    menuList.forEach(m => {
        const isCrunchy = m.nama.toLowerCase().includes('chicken crunchy');
        if (!isCrunchy) return;
        container.querySelectorAll(`input[name="ukuran-${m.id}"], input[name="varian-${m.id}"]`).forEach(inp =>
            inp.addEventListener('change', () => updateVariantUI(m.id)));
        container.querySelectorAll(`#select-filling-${m.id}, #select-saus-${m.id}, #select-bumbu-${m.id}`).forEach(sel =>
            sel?.addEventListener('change', () => updateVariantUI(m.id)));
    });

    // Bind tombol tambah
    container.querySelectorAll('.btn-add-to-cart').forEach(btn =>
        btn.addEventListener('click', e => {
            e.stopPropagation();
            addToCart(parseInt(btn.dataset.menuId));
        })
    );
}

function menuPickerHTML(menu) {
    const isCrunchy = menu.nama.toLowerCase().includes('chicken crunchy');

    let variantHtml = '';
    if (isCrunchy) {
        variantHtml = `
            <div class="cart-variant-panel" onclick="event.stopPropagation()">
                <div class="cvp-row">
                    <div class="cvp-col">
                        <div class="cvp-label">Ukuran</div>
                        <div class="radio-group">
                            <label class="radio-label"><input type="radio" name="ukuran-${menu.id}" value="Regular" checked> Regular</label>
                            <label class="radio-label"><input type="radio" name="ukuran-${menu.id}" value="Large"> Large</label>
                        </div>
                    </div>
                </div>
                <div class="cvp-row">
                    <div class="cvp-col">
                        <div class="cvp-label">Varian</div>
                        <div class="radio-group">
                            <label class="radio-label"><input type="radio" name="varian-${menu.id}" value="Original" checked> Original</label>
                            <label class="radio-label"><input type="radio" name="varian-${menu.id}" value="Filling"> Filling</label>
                            <label class="radio-label"><input type="radio" name="varian-${menu.id}" value="Saus Celup"> Saus Celup</label>
                            <label class="radio-label"><input type="radio" name="varian-${menu.id}" value="Bumbu Tabur"> Bumbu Tabur</label>
                            <label class="radio-label"><input type="radio" name="varian-${menu.id}" value="Filling + Saus Celup"> Filling + Saus</label>
                            <label class="radio-label"><input type="radio" name="varian-${menu.id}" value="Filling + Bumbu Tabur"> Filling + Bumbu</label>
                        </div>
                    </div>
                </div>
                <div class="variant-group hidden" id="group-filling-${menu.id}">
                    <div class="cvp-label">Pilihan Filling</div>
                    <select class="variant-select" id="select-filling-${menu.id}">
                        <option>Keju</option><option>Garlic Creamy</option><option>Mentai</option>
                    </select>
                </div>
                <div class="variant-group hidden" id="group-saus-${menu.id}">
                    <div class="cvp-label">Pilihan Saus</div>
                    <select class="variant-select" id="select-saus-${menu.id}">
                        <option>Keju</option><option>BBQ Spicy</option><option>Lada Hitam</option><option>Teriyaki</option>
                    </select>
                </div>
                <div class="variant-group hidden" id="group-bumbu-${menu.id}">
                    <div class="cvp-label">Pilihan Bumbu</div>
                    <select class="variant-select" id="select-bumbu-${menu.id}">
                        <option>Balado</option><option>Keju</option><option>Jagung Manis</option><option>Spicy</option>
                    </select>
                </div>
            </div>`;
    }

    return `
        <div class="menu-picker-card" data-id="${menu.id}" data-nama="${escHtml(menu.nama)}">
            <div class="menu-picker-top">
                <div class="menu-picker-info">
                    <div class="menu-picker-name">${escHtml(menu.nama)}</div>
                    <div class="menu-picker-price" id="display-price-${menu.id}">${formatRupiah(menu.harga)}</div>
                </div>
                <button class="btn-add-to-cart" data-menu-id="${menu.id}" title="Tambah ke pesanan">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Tambah
                </button>
            </div>
            ${variantHtml}
        </div>`;
}

/* =========================================================
   Cart Logic
   ========================================================= */
function addToCart(menuId) {
    const menu = menuList.find(m => m.id === menuId);
    if (!menu) return;

    const isCrunchy = menu.nama.toLowerCase().includes('chicken crunchy');
    let harga = menu.harga;
    let variantName = '';

    if (isCrunchy) {
        harga = calculateCrunchyPrice(menuId);
        variantName = getCrunchyVariantName(menuId);
    }

    cart.push({
        cartId: Date.now() + Math.random(),
        menuId,
        nama: menu.nama,
        harga,
        variantName,
        jumlah: 1
    });

    renderCart();

    // Feedback animasi
    const btn = document.querySelector(`[data-menu-id="${menuId}"].btn-add-to-cart`);
    if (btn) {
        btn.style.background = 'var(--color-success)';
        btn.style.color = '#fff';
        setTimeout(() => {
            btn.style.background = '';
            btn.style.color = '';
        }, 600);
    }
}

function removeFromCart(cartId) {
    cart = cart.filter(c => c.cartId !== cartId);
    renderCart();
}

function changeCartQty(cartId, delta) {
    const item = cart.find(c => c.cartId === cartId);
    if (!item) return;
    item.jumlah = Math.max(1, item.jumlah + delta);
    renderCart();
}

function renderCart() {
    const section = document.getElementById('order-summary');
    const preview = document.getElementById('order-items-preview');
    const totalEl = document.getElementById('order-total');
    if (!section || !preview || !totalEl) return;

    if (cart.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');

    const total = cart.reduce((s, c) => s + c.harga * c.jumlah, 0);
    totalEl.textContent = formatRupiah(total);

    preview.innerHTML = cart.map(item => `
        <div class="cart-row" data-cart-id="${item.cartId}">
            <div class="cart-row-info">
                <div class="cart-row-name">${escHtml(item.nama)}</div>
                ${item.variantName ? `<div class="cart-row-variant">${escHtml(item.variantName)}</div>` : ''}
            </div>
            <div class="cart-row-right">
                <div class="cart-qty-ctrl">
                    <button class="cart-qty-btn cart-minus" data-cart-id="${item.cartId}">−</button>
                    <span class="cart-qty-val">${item.jumlah}</span>
                    <button class="cart-qty-btn cart-plus" data-cart-id="${item.cartId}">+</button>
                </div>
                <div class="cart-row-price">${formatRupiah(item.harga * item.jumlah)}</div>
                <button class="cart-remove" data-cart-id="${item.cartId}" title="Hapus">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        </div>`).join('');

    // Bind cart controls
    preview.querySelectorAll('.cart-minus').forEach(btn =>
        btn.addEventListener('click', () => changeCartQty(parseFloat(btn.dataset.cartId), -1)));
    preview.querySelectorAll('.cart-plus').forEach(btn =>
        btn.addEventListener('click', () => changeCartQty(parseFloat(btn.dataset.cartId), +1)));
    preview.querySelectorAll('.cart-remove').forEach(btn =>
        btn.addEventListener('click', () => removeFromCart(parseFloat(btn.dataset.cartId))));
}

/* =========================================================
   Tambah Antrian
   ========================================================= */
export function openAddAntrianModal() {
    cart = [];
    document.getElementById('input-nama-pelanggan').value = '';
    document.getElementById('order-summary')?.classList.add('hidden');
    // Reset semua radio ke default
    document.querySelectorAll('input[type="radio"][value="Regular"]').forEach(r => r.checked = true);
    document.querySelectorAll('input[type="radio"][value="Original"]').forEach(r => r.checked = true);
    menuList.forEach(m => {
        if (m.nama.toLowerCase().includes('chicken crunchy')) {
            updateVariantUI(m.id);
        }
    });
    openModal('antrian');
}

export async function submitAntrian() {
    const nama = document.getElementById('input-nama-pelanggan').value.trim();
    if (!nama) { showToast('Nama pelanggan wajib diisi.', 'error'); return; }
    if (cart.length === 0) { showToast('Tambahkan minimal 1 menu ke pesanan.', 'error'); return; }

    // Gabung item yang sama persis (nama + variantName)
    const menusMap = {};
    cart.forEach(item => {
        const key = `${item.menuId}__${item.variantName}`;
        if (menusMap[key]) {
            menusMap[key].jumlah += item.jumlah;
        } else {
            menusMap[key] = { nama: item.nama, jumlah: item.jumlah, variantName: item.variantName, harga: item.harga };
        }
    });
    const menus = Object.values(menusMap);
    const total = menus.reduce((s, m) => s + m.harga * m.jumlah, 0);

    const btn = document.getElementById('btn-submit-antrian');
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
    try {
        await api.addQueue({ nama_pelanggan: nama, menus, total });
        showToast('Antrian berhasil ditambahkan!', 'success');
        closeModal('antrian');
        await loadAntrian();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Tambah Antrian'; }
    }
}

/* =========================================================
   Pembayaran QRIS
   ========================================================= */
function openPaymentModal(antrianId) {
    currentAntrianForPayment = antrianList.find(a => a.id === antrianId);
    if (!currentAntrianForPayment) return;

    document.getElementById('qris-amount').textContent   = formatRupiah(currentAntrianForPayment.total);
    document.getElementById('qris-customer').textContent = currentAntrianForPayment.nama_pelanggan;

    const qrContainer = document.getElementById('qr-code');
    if (qrContainer) {
        qrContainer.innerHTML = `<img src="../kris.jpeg" alt="QRIS" style="width:100%;height:100%;object-fit:contain;">`;
    }

    openModal('qris');
}

export async function konfirmasiPembayaran() {
    if (!currentAntrianForPayment) return;
    const btn = document.getElementById('btn-konfirmasi-bayar');
    if (btn) { btn.disabled = true; btn.textContent = 'Memproses...'; }

    try {
        const a = currentAntrianForPayment;
        await api.updateQueueStatus(a.id, 'selesai');
        await api.deleteQueue(a.id);

        const pesananStr = a.menus.map(m => `${m.nama}${m.variantName ? ` [${m.variantName}]` : ''} (x${m.jumlah})`).join(', ');
        LaporanManager.tambahData(a.nama_pelanggan, pesananStr, a.total, 'QRIS');

        showToast('Pembayaran QRIS berhasil!', 'success');
        closeModal('qris');
        currentAntrianForPayment = null;
        await loadAntrian();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Konfirmasi Bayar`; }
    }
}

async function bayarTunai(id) {
    const a = antrianList.find(x => x.id === id);
    if (!a || !confirm(`Konfirmasi pembayaran TUNAI untuk ${a.nama_pelanggan}?\nTotal: ${formatRupiah(a.total)}`)) return;
    try {
        await api.updateQueueStatus(id, 'selesai');
        await api.deleteQueue(id);
        const pesananStr = a.menus.map(m => `${m.nama}${m.variantName ? ` [${m.variantName}]` : ''} (x${m.jumlah})`).join(', ');
        LaporanManager.tambahData(a.nama_pelanggan, pesananStr, a.total, 'Tunai');
        showToast('Pembayaran tunai berhasil!', 'success');
        await loadAntrian();
    } catch (err) { showToast(err.message, 'error'); }
}

async function batalkanAntrian(id) {
    if (!confirm('Batalkan antrian ini?')) return;
    try {
        await api.deleteQueue(id);
        showToast('Antrian dibatalkan.', 'info');
        await loadAntrian();
    } catch (err) { showToast(err.message, 'error'); }
}

window.antrian = { loadAntrian, loadMenuForForm, openAddAntrianModal, submitAntrian, konfirmasiPembayaran };
export { antrianList };
