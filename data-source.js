// 号のデータを読む係。Mac のサーバーではそのまま読み、GitHub Pages（外）では暗号化したものを読んでこの端末の中で戻す。
// 外の置き場には data/lock.json（鍵を作る材料。秘密ではない）があり、号は「.enc」の暗号文だけが置いてある。
// 暗号化は scripts/publish_page.py が作る：中身を gzip で縮め、パスワードから作った鍵（PBKDF2）で AES-GCM 暗号化。
const page = document.getElementById("page");
const STORE_KEY = "kinou_note_key";
let lockPromise = null;
let keyPromise = null;

function bytesFromBase64(text) { return Uint8Array.from(atob(text), (character) => character.charCodeAt(0)); }
function base64FromBytes(bytes) { return btoa(String.fromCharCode(...bytes)); }

async function readLock() {
  const response = await fetch("data/lock.json", { cache: "no-cache" });
  return response.ok ? response.json() : null;
}

async function deriveKeyBytes(password, lock) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: bytesFromBase64(lock.salt), iterations: lock.iterations }, material, 256);
  return new Uint8Array(bits);
}

// 暗号文の先頭 12 バイトが IV（毎回変える乱数）、残りが本体。戻したら gzip をほどいて JSON にする。
async function decryptJson(keyBytes, buffer) {
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const bytes = new Uint8Array(buffer);
  const zipped = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, key, bytes.slice(12));
  const stream = new Blob([zipped]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text());
}

async function fetchBuffer(path) {
  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${path} を読めません（${response.status}）`);
  return response.arrayBuffer();
}

function loadSavedKey(lock) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    return saved && saved.salt === lock.salt ? bytesFromBase64(saved.key) : null;
  } catch (error) {
    return null;
  }
}

function saveKey(lock, keyBytes) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ salt: lock.salt, key: base64FromBytes(keyBytes) }));
  } catch (error) {
    console.warn("この端末に鍵を保存できませんでした", error);
  }
}

function forgetKey() {
  try { localStorage.removeItem(STORE_KEY); } catch (error) { console.warn("鍵を消せませんでした", error); }
}

async function keyOpensIndex(keyBytes) {
  try {
    await decryptJson(keyBytes, await fetchBuffer("data/index.json.enc"));
    return true;
  } catch (error) {
    return false;
  }
}

// パスワードの画面を出し、正しい鍵ができるまで待つ。
function askPassword(lock) {
  page.innerHTML = `
    <form class="lock-box" id="lock-form">
      <p class="lock-owl" aria-hidden="true">🦉🔒</p>
      <h1 class="lock-title">合言葉でひらくノート</h1>
      <p class="lock-note">パスワードを入れてください</p>
      <input type="password" id="lock-password" autocomplete="current-password" aria-label="パスワード">
      <label class="lock-remember"><input type="checkbox" id="lock-remember" checked>この端末に覚えておく</label>
      <button type="submit" id="lock-button">ひらく</button>
      <p class="lock-error" id="lock-error" hidden>パスワードがちがいます</p>
    </form>`;
  return new Promise((resolve) => {
    document.getElementById("lock-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = document.getElementById("lock-button");
      const errorLine = document.getElementById("lock-error");
      button.disabled = true; button.textContent = "たしかめ中…"; errorLine.hidden = true;
      const keyBytes = await deriveKeyBytes(document.getElementById("lock-password").value, lock);
      if (await keyOpensIndex(keyBytes)) {
        if (document.getElementById("lock-remember").checked) saveKey(lock, keyBytes);
        page.innerHTML = '<p class="loading">🦉 ノートをひらいています…</p>';
        resolve(keyBytes);
        return;
      }
      errorLine.hidden = false; button.disabled = false; button.textContent = "ひらく";
    });
  });
}

async function obtainKey(lock) {
  const savedKey = loadSavedKey(lock);
  if (savedKey && await keyOpensIndex(savedKey)) return savedKey;
  if (savedKey) forgetKey();  // パスワードを変えたあとは、覚えていた鍵が合わなくなる
  return askPassword(lock);
}

export async function fetchJson(path) {
  lockPromise ??= readLock().catch(() => null);
  const lock = await lockPromise;
  if (!lock) {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error(`${path} を読めません（${response.status}）`);
    return response.json();
  }
  keyPromise ??= obtainKey(lock);
  return decryptJson(await keyPromise, await fetchBuffer(`${path}.enc`));
}
