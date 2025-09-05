// Auto-detect backend + run commands UI controller

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
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(8px)';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

// ---------- Backend auto-detect ----------
const LS_API_BASE = 'rbx.multi.apiBase';
let API_BASE = null;

function candidateBases() {
  const list = [];
  const saved = localStorage.getItem(LS_API_BASE);
  if (saved) list.push(saved);

  // Same origin (if served by the node server)
  if (/^https?:\/\//i.test(location.origin)) list.push(location.origin);

  // Common locals
  ['http://localhost:3000', 'http://127.0.0.1:3000',
   'http://localhost:3333', 'http://127.0.0.1:3333',
   'http://localhost:8765', 'http://127.0.0.1:8765']
    .forEach(b => { if (!list.includes(b)) list.push(b); });

  return list;
}

async function isHealthy(base) {
  try {
    const res = await fetch(base.replace(/\/$/, '') + '/api/health', {
      method: 'GET',
      cache: 'no-store',
      mode: 'cors'
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function detectApiBase() {
  append('Scanning for backend...', 'muted');
  const candidates = candidateBases();
  for (const base of candidates) {
    if (await isHealthy(base)) {
      API_BASE = base.replace(/\/$/, '');
      append(`Connected to backend at ${API_BASE}`, 'ok');
      localStorage.setItem(LS_API_BASE, API_BASE);
      return API_BASE;
    }
  }
  append('Cannot reach backend. Make sure "npm start" is running.', 'err');
  return null;
}

async function ensureBackend() {
  if (API_BASE) return API_BASE;
  const saved = localStorage.getItem(LS_API_BASE);
  if (saved && await isHealthy(saved)) {
    API_BASE = saved;
    append(`Using saved backend: ${API_BASE}`, 'ok');
    return API_BASE;
  }
  return detectApiBase();
}

function apiUrl(path) {
  if (!API_BASE) return path; // will be set before use
  return API_BASE + (path.startsWith('/') ? path : '/' + path);
}

// ---------- Accounts / command helpers ----------
function parseAccounts(raw) {
  return raw
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const sep = line.includes('|') ? '|' : (line.includes(':') ? ':' : null);
      if (!sep) return null;
      const [labelRaw, cookieRaw] = line.split(sep);
      const label = (labelRaw || '').trim();
      let cookie = (cookieRaw || '').trim();
      const idx = cookie.indexOf('.ROBLOSECURITY=');
      if (idx !== -1) cookie = cookie.slice(idx + '.ROBLOSECURITY='.length);
      if (!label || !cookie) return null;
      return { label, cookie };
    })
    .filter(Boolean);
}

function updateAccountCount() {
  const count = parseAccounts(accountsTextarea.value).length;
  accountCount.textContent = count;
}

function setLoading(isLoading) {
  if (isLoading) {
    runBtn.classList.add('loading');
    runBtn.setAttribute('disabled', 'true');
  } else {
    runBtn.classList.remove('loading');
    runBtn.removeAttribute('disabled');
  }
}

function setProgress(pct) {
  if (!bar) return;
  bar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

// ---------- Run command ----------
async function run() {
  const cmd = commandInput.value.trim();
  if (!cmd) {
    showToast('Enter a command.', 'err');
    commandInput.focus();
    return;
  }
  const accounts = parseAccounts(accountsTextarea.value);
  if (!accounts.length) {
    showToast('Add at least one account line: Label|.ROBLOSECURITY cookie', 'err');
    accountsTextarea.focus();
    return;
  }

  output.textContent = '';
  setLoading(true);
  setProgress(12);

  const base = await ensureBackend();
  if (!base) {
    setLoading(false);
    setProgress(0);
    return;
  }

  append(`Running "${cmd}" for ${accounts.length} account(s)...`, 'muted');
  setProgress(28);

  try {
    const res = await fetch(apiUrl('/api/run'), {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accounts, command: cmd })
    });

    setProgress(50);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      append(`Server error (${res.status}): ${text}`, 'err');
      showToast(`Server error ${res.status}`, 'err');
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (!Array.isArray(data.results)) {
      append('Unexpected response from server.', 'err');
      return;
    }

    let i = 0;
    for (const r of data.results) {
      i++;
      const prefix = r.ok ? '✔' : '✖';
      append(`${prefix} ${r.label}: ${r.message}`, r.ok ? 'ok' : 'err');
      setProgress(50 + Math.round((i / data.results.length) * 50));
      await new Promise(r => setTimeout(r, 90));
    }

    showToast('Done!', 'ok');
  } catch (e) {
    append(`Request failed: ${e.message || e}`, 'err');
    showToast('Request failed', 'err');
  } finally {
    setLoading(false);
    setTimeout(() => setProgress(0), 1000);
  }
}

// ---------- Events / storage ----------
runBtn?.addEventListener('click', run);
commandInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); }
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'enter') run();
});
chips.forEach(ch => ch.addEventListener('click', () => {
  commandInput.value = ch.getAttribute('data-example');
  commandInput.focus();
}));

clearLogBtn?.addEventListener('click', () => { output.textContent = ''; });

const LS_ACCOUNTS = 'rbx.multi.accounts';
const LS_COMMAND = 'rbx.multi.lastCommand';

function loadFromStorage() {
  const a = localStorage.getItem(LS_ACCOUNTS);
  if (a) accountsTextarea.value = a;
  const c = localStorage.getItem(LS_COMMAND);
  if (c) commandInput.value = c;
  updateAccountCount();
}
function saveToStorage() {
  localStorage.setItem(LS_ACCOUNTS, accountsTextarea.value);
  localStorage.setItem(LS_COMMAND, commandInput.value.trim());
  showToast('Saved locally', 'ok');
}
saveBtn?.addEventListener('click', saveToStorage);
clearBtn?.addEventListener('click', () => {
  accountsTextarea.value = '';
  updateAccountCount();
  saveToStorage();
});
accountsTextarea?.addEventListener('input', updateAccountCount);
commandInput?.addEventListener('input', () => {
  localStorage.setItem(LS_COMMAND, commandInput.value.trim());
});

loadFromStorage();
append('Ready. Paste accounts, type a command, and click Run.', 'muted');
detectApiBase();
