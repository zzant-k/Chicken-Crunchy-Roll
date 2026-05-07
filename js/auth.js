/**
 * auth.js — Login, logout, dan proteksi halaman
 * Menggunakan path auto-detect agar bisa jalan di folder manapun.
 */
import api from './api.js';

const TOKEN_KEY = 'angkringan_token';
const USER_KEY  = 'angkringan_user';

/**
 * Hitung base URL folder root project secara otomatis.
 * Bekerja baik dari /angkringanku/ maupun dari subfolder /pages/.
 */
export function getBaseUrl() {
    const path = window.location.pathname;
    const base = path
        .replace(/\/[^/]*\.html$/, '') // hapus nama file .html
        .replace(/\/pages$/, '')      // hapus /pages jika di subfolder
        .replace(/\/$/, '');          // hapus trailing slash jika ada
    return base;
}

export async function login(username, password) {
    const data = await api.login({ username, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data;
}

export async function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = getBaseUrl() + '/index.html';
}

export function requireAuth() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        window.location.href = getBaseUrl() + '/index.html';
        return false;
    }
    return true;
}

export function redirectIfAuth() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
        window.location.href = getBaseUrl() + '/pages/dashboard.html';
        return true;
    }
    return false;
}

export function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); }
    catch { return null; }
}

// Expose ke window agar bisa dipakai dari script non-module (legacy)
window.auth = { login, logout, requireAuth, redirectIfAuth, getUser };
