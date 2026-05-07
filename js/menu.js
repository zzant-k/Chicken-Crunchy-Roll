/**
 * menu.js — Read-only menu display dengan edit harga per size section
 * Harga disimpan ke localStorage agar persisten.
 */
import api from './api.js';
import { escHtml, formatRupiah } from './utils.js';

let allMenus = [];

const STORAGE_KEY = 'crunchy_prices';

// Harga default — hanya dipakai jika belum ada di localStorage
const DEFAULT_PRICES = {
    regular: [
        { varian: 'Original',             harga: 15000 },
        { varian: 'Filling',              harga: 17000 },
        { varian: 'Saus Celup',           harga: 17000 },
        { varian: 'Bumbu Tabur',          harga: 17000 },
        { varian: 'Filling + Saus Celup', harga: 22000 },
        { varian: 'Filling + Bumbu Tabur',harga: 20000 },
    ],
    large: [
        { varian: 'Original',             harga: 23000 },
        { varian: 'Filling',              harga: 25000 },
        { varian: 'Saus Celup',           harga: 25000 },
        { varian: 'Bumbu Tabur',          harga: 25000 },
        { varian: 'Filling + Saus Celup', harga: 30000 },
        { varian: 'Filling + Bumbu Tabur',harga: 28000 },
    ],
    pilihan: {
        filling: ['Keju', 'Garlic Creamy', 'Mentai'],
        saus:    ['Keju', 'BBQ Spicy', 'Lada Hitam', 'Teriyaki'],
        bumbu:   ['Balado', 'Keju', 'Jagung Manis', 'Spicy'],
    }
};

/* Ambil harga dari localStorage, fallback ke default */
function getPrices() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DEFAULT_PRICES));
    } catch {
        return JSON.parse(JSON.stringify(DEFAULT_PRICES));
    }
}

/* Simpan harga ke localStorage */
function savePrices(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/* State edit modal */
let editingSize = null; // 'regular' | 'large'

/* =========================================================
   Load & Render
   ========================================================= */
export async function loadMenus() {
    allMenus = await api.getMenu();
    renderMenus(allMenus);
    return allMenus;
}

function renderMenus(menus) {
    const container = document.getElementById('menu-list');
    if (!container) return;

    if (menus.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>Belum ada menu terdaftar.</p></div>`;
        return;
    }

    container.innerHTML = menus.map(menu => menuItemHTML(menu)).join('');

    // Bind edit buttons
    container.querySelectorAll('.btn-edit-size').forEach(btn => {
        btn.addEventListener('click', () => openPriceEditModal(btn.dataset.size));
    });
}

/* =========================================================
   Size Variant Grid (dengan tombol Edit di header)
   ========================================================= */
function sizeGridHTML(list, label, sizeClass, sizeKey) {
    return `
        <div class="menu-size-section">
            <div class="menu-size-label">
                <div class="menu-size-dot menu-size-dot--${sizeClass}"></div>
                <span class="menu-size-text">${label}</span>
                <button class="btn-edit-size" data-size="${sizeKey}" title="Edit harga ${label}" style="
                    margin-left: auto;
                    display: flex; align-items: center; gap: 4px;
                    font-size: 11px; font-weight: 600;
                    color: var(--color-text-muted);
                    background: var(--color-surface-2);
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-sm);
                    padding: 3px 8px;
                    cursor: pointer;
                    transition: all 0.15s;
                " onmouseover="this.style.color='var(--color-text)';this.style.borderColor='var(--color-text-muted)'"
                   onmouseout="this.style.color='var(--color-text-muted)';this.style.borderColor='var(--color-border)'">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Edit
                </button>
            </div>
            <div class="variant-grid">
                ${list.map((v, idx) => `
                    <div class="variant-cell" data-size="${sizeKey}" data-idx="${idx}">
                        <span class="variant-cell-name">${v.varian}</span>
                        <span class="variant-cell-price">${formatRupiah(v.harga)}</span>
                    </div>`).join('')}
            </div>
        </div>`;
}

/* =========================================================
   Add-on Horizontal Scroll Pills
   ========================================================= */
function addonGroupHTML(label, items, iconSvg) {
    return `
        <div class="addon-group">
            <div class="addon-group-label">
                ${iconSvg}
                <span>${label}</span>
            </div>
            <div class="addon-pills">
                ${items.map(i => `<div class="addon-pill">${i}</div>`).join('')}
            </div>
        </div>`;
}

const ICONS = {
    filling: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
    saus:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2h8l4 10H4L8 2z"/><path d="M4 12v6a4 4 0 004 4h8a4 4 0 004-4v-6"/></svg>`,
    bumbu:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
};

/* =========================================================
   Main Card HTML
   ========================================================= */
function menuItemHTML(menu) {
    const isCrunchy = menu.nama.toLowerCase().includes('chicken crunchy');
    const prices = getPrices();

    const variantSection = isCrunchy ? `
        <div class="menu-section-divider"></div>
        ${sizeGridHTML(prices.regular, 'Regular', 'regular', 'regular')}
        ${sizeGridHTML(prices.large,   'Large',   'large',   'large')}
        <div class="menu-section-divider"></div>
        <div class="addon-section">
            <div class="addon-title">Pilihan Kustomisasi</div>
            ${addonGroupHTML('Filling',     prices.pilihan.filling, ICONS.filling)}
            ${addonGroupHTML('Saus Celup',  prices.pilihan.saus,    ICONS.saus)}
            ${addonGroupHTML('Bumbu Tabur', prices.pilihan.bumbu,   ICONS.bumbu)}
        </div>` : '';

    return `
        <div class="menu-card" id="menu-item-${menu.id}">
            <div class="menu-card-header">
                <div class="menu-card-photo" style="padding: 0; border: none; overflow: hidden; background: transparent;">
                    <img 
                        src="../logo.jpeg" 
                        alt="Foto Produk" 
                        style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;"
                    >
                </div>
                <div class="menu-card-info">
                    <div class="menu-card-name">
                        ${escHtml(menu.nama)}
                    </div>
                    <div class="menu-card-price">
                        Mulai dari <strong>${formatRupiah(menu.harga)}</strong>
                    </div>
                </div>
            </div>
            
            ${variantSection}
        </div>
    `;
}

/* =========================================================
   Modal Edit Harga per Size
   ========================================================= */
function openPriceEditModal(sizeKey) {
    editingSize = sizeKey;
    const prices = getPrices();
    const list = prices[sizeKey];
    const label = sizeKey === 'regular' ? 'Regular' : 'Large';

    // Update modal title
    document.getElementById('price-edit-title').textContent = `Edit Harga — ${label}`;

    // Generate input fields
    const fields = document.getElementById('price-edit-fields');
    fields.innerHTML = `
        <p style="font-size: 12px; color: var(--color-text-muted); margin-bottom: 16px;">
            Ubah harga untuk setiap varian ukuran <strong>${label}</strong>. Perubahan langsung tersimpan.
        </p>
        <div style="display: flex; flex-direction: column; gap: 12px;">
            ${list.map((v, idx) => `
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                    <label style="font-size: 13px; font-weight: 500; color: var(--color-text); flex: 1;">${v.varian}</label>
                    <div style="position: relative; width: 130px;">
                        <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 12px; color: var(--color-text-muted); pointer-events: none;">Rp</span>
                        <input
                            type="number"
                            class="form-control price-input"
                            data-idx="${idx}"
                            value="${v.harga}"
                            min="0"
                            step="500"
                            style="padding-left: 30px; font-size: 13px; text-align: right; font-weight: 600;"
                        >
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    // Bind save button
    const saveBtn = document.getElementById('btn-save-prices');
    // Clone to remove old listener
    const newBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newBtn, saveBtn);
    newBtn.addEventListener('click', savePriceEdits);

    // Open modal
    document.getElementById('price-edit-overlay').classList.add('open');
}

function savePriceEdits() {
    const prices = getPrices();
    const inputs = document.querySelectorAll('.price-input');

    inputs.forEach(input => {
        const idx = parseInt(input.dataset.idx);
        const val = parseFloat(input.value);
        if (!isNaN(val) && val >= 0) {
            prices[editingSize][idx].harga = val;
        }
    });

    savePrices(prices);

    // Tutup modal
    document.getElementById('price-edit-overlay').classList.remove('open');

    // Re-render supaya harga langsung update
    renderMenus(allMenus);
}

window.menu = { loadMenus };
export { allMenus };
