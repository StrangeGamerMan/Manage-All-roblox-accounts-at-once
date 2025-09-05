// Frontend controller with explicit API base + health check + animated UI hooks

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

// Always talk to the Node backend on 3000. If you change the port in server.js, update this too.
const API_BASE = 'http://localhost:3000';

function apiUrl(path) {
  return API_BASE.replace(/\/$/, '') + (path.startsWith('/') ? path : '/' + path);
}

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
  bar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

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
  append(`Using API: ${API_BASE}`, 'muted');
  append(`Running "${cmd}" for ${accounts.length} account(s)...`, 'muted');
  setLoading(true);
  setProgress(18);

  try {
    const res = await fetch(apiUrl('/api/run'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accounts, command: cmd })
    });

    setProgress(45);

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
      const cls = r.ok ? 'ok' : 'err';
      append(`${prefix} ${r.label}: ${r.message}`, cls);
      setProgress(45 + Math.round((i / data.results.length) * 55));
      await new Promise(r => setTimeout(r, 90));
    }

    showToast('Done!', 'ok');
  } catch (e) {
    append(`Request failed: ${e.message || e}`, 'err');
    showToast('Request failed', 'err');
  } finally {
    setLoading(false);
    setTimeout(() => setProgress(0), 1200);
  }
}

// Event wiring
runBtn.addEventListener('click', run);
commandInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    run();
  }
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'enter') {
    run();
  }
});
chips.forEach(ch => ch.addEventListener('click', () => {
  commandInput.value = ch.getAttribute('data-example');
  commandInput.focus();
}));

clearLogBtn.addEventListener('click', () => {
  output.textContent = '';
});

// Local storage helpers
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
saveBtn.addEventListener('click', saveToStorage);
clearBtn.addEventListener('click', () => {
  accountsTextarea.value = '';
  updateAccountCount();
  saveToStorage();
});

accountsTextarea.addEventListener('input', updateAccountCount);
commandInput.addEventListener('input', () => {
  localStorage.setItem(LS_COMMAND, commandInput.value.trim());
});

async function pingBackend() {
  try {
    const res = await fetch(apiUrl('/api/health'));
    if (res.ok) {
      append(`Backend online at ${API_BASE}`, 'ok');
    } else {
      append(`Backend responded ${res.status} at ${API_BASE}`, 'err');
    }
  } catch {
    append(`Cannot reach backend at ${API_BASE}. Make sure "npm start" is running.`, 'err');
  }
}

loadFromStorage();
append('Ready. Paste accounts, type a command, and click Run.', 'muted');
pingBackend();
