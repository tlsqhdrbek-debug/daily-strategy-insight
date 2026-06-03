// auth.js — BNK Capital Strategy Insight device-auth gate
// AES-GCM 256 / PBKDF2-SHA256. Caches derived key in localStorage.
(function (global) {
  'use strict';

  const STORAGE_KEY = 'dsi_key_b64';
  const CONFIG_URL  = 'tools/auth-config.json';
  const VERIFY_URL  = 'data/.verify.json';
  const SENTINEL    = 'DSI_OK';

  let _config = null;
  let _cryptoKey = null;

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }
  function bytesToB64(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  async function loadConfig() {
    if (_config) return _config;
    const r = await fetch(CONFIG_URL, { cache: 'force-cache' });
    if (!r.ok) throw new Error('auth-config 로드 실패 (' + r.status + ')');
    _config = await r.json();
    return _config;
  }

  async function deriveKey(password) {
    const cfg = await loadConfig();
    const salt = b64ToBytes(cfg.saltB64);
    const baseKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt, iterations: cfg.iter, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: cfg.keyLen },
      true,
      ['decrypt']
    );
  }

  async function decryptBlob(blob, key) {
    const iv = b64ToBytes(blob.iv);
    const ct = b64ToBytes(blob.ct);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct);
    return new TextDecoder().decode(plain);
  }

  async function verifySentinel(key) {
    const r = await fetch(VERIFY_URL, { cache: 'no-cache' });
    if (!r.ok) throw new Error('verify 파일 로드 실패 (' + r.status + ')');
    const blob = await r.json();
    try {
      const txt = await decryptBlob(blob, key);
      return txt === SENTINEL;
    } catch (e) {
      return false;
    }
  }

  async function getCachedKey() {
    if (_cryptoKey) return _cryptoKey;
    const b64 = localStorage.getItem(STORAGE_KEY);
    if (!b64) return null;
    try {
      const raw = b64ToBytes(b64);
      const cfg = await loadConfig();
      _cryptoKey = await crypto.subtle.importKey(
        'raw',
        raw,
        { name: 'AES-GCM', length: cfg.keyLen },
        false,
        ['decrypt']
      );
      return _cryptoKey;
    } catch (e) {
      console.warn('cached key load failed', e);
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  async function cacheKey(key) {
    const raw = await crypto.subtle.exportKey('raw', key);
    localStorage.setItem(STORAGE_KEY, bytesToB64(raw));
    _cryptoKey = key;
  }

  function clearKey() {
    localStorage.removeItem(STORAGE_KEY);
    _cryptoKey = null;
  }

  async function login(password) {
    const key = await deriveKey(password);
    const ok = await verifySentinel(key);
    if (!ok) return false;
    await cacheKey(key);
    return true;
  }

  async function requireAuth() {
    const key = await getCachedKey();
    if (key) {
      const ok = await verifySentinel(key).catch(() => false);
      if (ok) return key;
      clearKey();
    }
    const ret = encodeURIComponent(location.pathname + location.search + location.hash);
    location.replace('login.html?return=' + ret);
    return null;
  }

  function looksLikeEncrypted(text) {
    const t = text.trimStart();
    if (!t.startsWith('{')) return null;
    try {
      const obj = JSON.parse(text);
      if (obj && obj.v === 1 && typeof obj.iv === 'string' && typeof obj.ct === 'string') {
        return obj;
      }
    } catch (e) { /* fall through */ }
    return null;
  }

  async function fetchEncrypted(url) {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('파일 로드 실패 (' + r.status + ')');
    const text = await r.text();
    const blob = looksLikeEncrypted(text);
    if (!blob) {
      // Transition fallback: file not yet encrypted by the CI workflow.
      // Once the workflow has processed every data/ file, this path is never taken.
      return text;
    }
    const key = await getCachedKey();
    if (!key) throw new Error('not authenticated');
    return decryptBlob(blob, key);
  }

  global.DSIAuth = {
    deriveKey, login, requireAuth, clearKey,
    fetchEncrypted, decryptBlob, getCachedKey, verifySentinel
  };
})(window);
