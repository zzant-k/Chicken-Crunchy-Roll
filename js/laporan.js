/**
 * laporan.js — Logika pengelolaan laporan keuangan harian
 * Fitur: Auto-clean (3 hari), Grouping, dan Rendering Logic.
 */

const STORAGE_KEY = "laporan";

/**
 * Helper: Mendapatkan tanggal hari ini (YYYY-MM-DD)
 */
function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

/**
 * a. Menambahkan transaksi baru
 */
function tambahData(nama, pesanan, total, metodePembayaran = '-') {
    const dataLama = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    const dataBaru = {
        nama_customer: nama,
        daftar_pesanan: pesanan,
        total_harga: Number(total),
        metodePembayaran: metodePembayaran,
        createdAt: getTodayString()
    };
    dataLama.push(dataBaru);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataLama));
}

/**
 * b. Mengambil data valid (maksimal 3 hari terakhir)
 * Menghapus data > 3 hari secara otomatis.
 */
function getDataValid() {
    const rawData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    const today = new Date(getTodayString());
    
    const dataValid = rawData.filter(item => {
        const itemDate = new Date(item.createdAt);
        const diffInMs = today - itemDate;
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
        
        // Rule: <= 3 hari tetap disimpan, > 3 hari dihapus
        return diffInDays <= 3;
    });
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataValid));
    return dataValid;
}

/**
 * c. Mengambil data hari ini saja
 */
function getDataHariIni() {
    const validData = getDataValid();
    const todayStr = getTodayString();
    return validData.filter(item => item.createdAt === todayStr);
}

/**
 * d. Mengambil riwayat & mengelompokkan berdasarkan tanggal
 */
function getDataRiwayat() {
    const validData = getDataValid();
    const grouped = {};

    validData.forEach(item => {
        if (!grouped[item.createdAt]) {
            grouped[item.createdAt] = [];
        }
        grouped[item.createdAt].push(item);
    });

    return grouped;
}

/**
 * e. Menghapus seluruh data
 */
function hapusSemuaData() {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * 7. RENDERING FUNCTIONS (Placeholder Logic)
 * Mengupdate elemen UI yang ada berdasarkan ID
 */

function renderHariIni(data) {
    const container = document.getElementById('laporan-hari-ini');
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = '<tr><td colspan="3">Tidak ada data hari ini.</td></tr>';
        return;
    }

    container.innerHTML = data.map(item => `
        <tr>
            <td>${item.nama_customer}</td>
            <td>${Array.isArray(item.daftar_pesanan) ? item.daftar_pesanan.join(', ') : item.daftar_pesanan}</td>
            <td>Rp ${item.total_harga.toLocaleString('id-ID')}</td>
        </tr>
    `).join('');
}

function renderRiwayat(groupedData) {
    const container = document.getElementById('laporan-riwayat');
    if (!container) return;

    const dates = Object.keys(groupedData).sort().reverse(); // Urutkan terbaru ke terlama

    if (dates.length === 0) {
        container.innerHTML = '<div class="empty-msg">Belum ada riwayat.</div>';
        return;
    }

    container.innerHTML = dates.map(date => {
        const items = groupedData[date];
        const totalDay = items.reduce((sum, i) => sum + i.total_harga, 0);
        
        return `
            <div class="riwayat-section">
                <h3 class="riwayat-date">${date} (Total: Rp ${totalDay.toLocaleString('id-ID')})</h3>
                <table class="table-riwayat">
                    ${items.map(i => `
                        <tr>
                            <td>${i.nama_customer}</td>
                            <td>Rp ${i.total_harga.toLocaleString('id-ID')}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>
        `;
    }).join('');
}

/**
 * AUTO CLEAN & INITIALIZE
 */
getDataValid();

// Ekspor ke window agar bisa diakses langsung dari UI
window.LaporanManager = {
    tambahData,
    getDataValid,
    getDataHariIni,
    getDataRiwayat,
    hapusSemuaData,
    renderHariIni,
    renderRiwayat
};

export default window.LaporanManager;
