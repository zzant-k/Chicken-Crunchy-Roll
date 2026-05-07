/**
 * qris.js — QR Code generator untuk simulasi pembayaran QRIS
 */
export function generateQR(total) {
    const container = document.getElementById('qr-code');
    if (!container) return;
    container.innerHTML = '';
    const payload = `QRIS.ID|ANGKRINGAN.KU|TOTAL:${Math.round(total)}|${Date.now()}`;
    if (typeof QRCode === 'undefined') {
        container.innerHTML = '<p style="color:var(--color-text-muted);font-size:12px;">QR Code tidak tersedia.</p>';
        return;
    }
    new QRCode(container, {
        text: payload,
        width: 200,
        height: 200,
        colorDark: '#000',
        colorLight: '#fff',
        correctLevel: QRCode.CorrectLevel.M,
    });
}
