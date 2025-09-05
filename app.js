// Frontend uses window.API_BASE (set in index.html) or falls back to auto-detect.

const accountsTextarea = document.getElementById('accounts');
const commandInput = document.getElementById('commandInput');
const output = document.getElementById('output');
const runBtn = document.getElementById('runCommand');
const saveBtn = document.getElementById('saveAccounts');
const clearBtn = document.getElementById('clearAccounts');
const clearLogBtn = document.getElementById('clearLog');
const chips = document.querySelectorAll('[data-example]');
const bar = document.getElementById('bar');
const accountCount = document.getElementById('accountCount');
const toasts = document.getElementById('toasts');

function append(line, cls = '') {
  const div = document.createElement('div');
  div.className = `log-line ${cls}`;
  div.textContent = line;
  output.appendChild(div);
  output.scrollTop = output.scrollHeight;
}
function showToast(text, type = '') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = text;
  toasts.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; setTimeout(() => t.remove(), 300); }, 3000);
}

// ---------- Backend base ----------
const LS_API_BASE = 'rbx.multi.apiBase';
let API_BASE = null;

function candidateBases() {
  const list = [];
  if (typeof window !== 'undefined' && window.API_BASE) list.push(String(window.API_BASE).replace(/\/$/, ''));
  const saved = localStorage.getItem(LS_API_BASE);
  if (saved) list.push(saved);
  if (/^https?:\/\//i.test(location.origin)) list.push(location.origin);
  ['http://127.0.0.1:3000','http://localhost:3000','http://127.0.0.1:3333','http://localhost:3333']
    .forEach(b => { if (!list.includes(b)) list.push(b); });
  return list;
}

async function isHealthy(base) {
  try { const res = await fetch(base + '/api/health', { cache: 'no-store', mode: 'cors' }); return res.ok; }
  catch { return false; }
}

async function detectApiBase() {
  const candidates = candidateBases();
  for (const base of candidates) {
    if (!base) continue;
    if (await isHealthy(base)) {
      API_BASE = base;
      localStorage.setItem(LS_API_BASE, API_BASE);
      append(`Connected to backend at ${API_BASE}`, 'ok');
      return API_BASE;
    }
  }
  append('Cannot reach backend. Set window.API_BASE or start your server.', 'err');
  return null;
}

function apiUrl(p) { return (API_BASE || '') + (p.startsWith('/') ? p : '/' + p); }

// ---------- Accounts / command helpers ----------
function parseAccounts(raw) {
  return raw.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const sep = line.includes('|') ? '|' : (line.includes(':') ? ':' : null);
    if (!sep) return null;
    const [labelRaw, cookieRaw] = line.split(sep);
    const label = (labelRaw || '').trim();
    let cookie = (cookieRaw || '').trim();
    const idx = cookie.indexOf('.ROBLOSECURITY=');
    if (idx !== -1) cookie = cookie.slice(idx + '.ROBLOSECURITY='.length);
    if (!label || !cookie) return null;
    return { label, cookie };
  }).filter(Boolean);
}

function updateAccountCount() { accountCount.textContent = parseAccounts(accountsTextarea.value).length; }
function setLoading(v){ if(v){runBtn.classList.add('loading');runBtn.disabled=true;}else{runBtn.classList.remove('loading');runBtn.disabled=false;} }
function setProgress(p){ bar.style.width = `${Math.max(0,Math.min(100,p))}%`; }

// ---------- Run ----------
async function run() {
  const cmd = commandInput.value.trim();
  if (!cmd) { showToast('Enter a command.', 'err'); commandInput.focus(); return; }
  const accounts = parseAccounts(accountsTextarea.value);
  if (!accounts.length) { showToast('Add at least one account line: Label|.ROBLOSECURITY cookie', 'err'); accountsTextarea.focus(); return; }

  output.textContent = '';
  setLoading(true); setProgress(12);

  if (!API_BASE) await detectApiBase();
  if (!API_BASE) { setLoading(false); setProgress(0); return; }

  append(`Running "${cmd}" for ${accounts.length} account(s)...`, 'muted'); setProgress(28);

  try {
    const res = await fetch(apiUrl('/api/run'), {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accounts, command: cmd })
    });
    setProgress(50);

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      append(`Server error (${res.status}): ${txt}`, 'err');
      showToast(`Server error ${res.status}`, 'err');
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (!Array.isArray(data.results)) { append('Unexpected response from server.', 'err'); return; }

    let i = 0;
    for (const r of data.results) {
      i++;
      append(`${r.ok ? '✔' : '✖'} ${r.label}: ${r.message}`, r.ok ? 'ok' : 'err');
      setProgress(50 + Math.round((i / data.results.length) * 50));
      await new Promise(r => setTimeout(r, 90));
    }
    showToast('Done!', 'ok');
  } catch (e) {
    append(`Request failed: ${e.message || e}`, 'err');
    showToast('Request failed', 'err');
  } finally {
    setLoading(false); setTimeout(() => setProgress(0), 1000);
  }
}

// Events/storage
runBtn.addEventListener('click', run);
commandInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); }});
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'enter') run(); });
chips.forEach(ch => ch.addEventListener('click', () => { commandInput.value = ch.getAttribute('data-example'); commandInput.focus(); }));
clearLogBtn.addEventListener('click', () => output.textContent = '');
const LS_ACCOUNTS = 'rbx.multi.accounts', LS_COMMAND = 'rbx.multi.lastCommand';
(function init() {
  const a = localStorage.getItem(LS_ACCOUNTS); if (a) accountsTextarea.value = a;
  const c = localStorage.getItem(LS_COMMAND); if (c) commandInput.value = c;
  accountsTextarea.addEventListener('input', () => { localStorage.setItem(LS_ACCOUNTS, accountsTextarea.value); updateAccountCount(); });
  commandInput.addEventListener('input', () => localStorage.setItem(LS_COMMAND, commandInput.value.trim()));
  updateAccountCount();
  append('Ready. Paste accounts, set backend, and Run.', 'muted');
  if (window.API_BASE) detectApiBase();
})();
