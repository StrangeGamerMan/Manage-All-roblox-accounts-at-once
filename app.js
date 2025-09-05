const accountsTextarea = document.getElementById('accounts');
const commandInput = document.getElementById('commandInput');
const output = document.getElementById('output');
const runBtn = document.getElementById('runCommand');

function append(line) {
  output.textContent += line + '\n';
  output.scrollTop = output.scrollHeight;
}

function parseAccounts(raw) {
  return raw
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      // Allow "Label|cookie" OR "Label:cookie"
      const sep = line.includes('|') ? '|' : (line.includes(':') ? ':' : null);
      if (!sep) return null;
      const [labelRaw, cookieRaw] = line.split(sep);
      const label = (labelRaw || '').trim();
      let cookie = (cookieRaw || '').trim();

      // If they pasted ".ROBLOSECURITY=XXXXX", extract the value
      const idx = cookie.indexOf('.ROBLOSECURITY=');
      if (idx !== -1) cookie = cookie.slice(idx + '.ROBLOSECURITY='.length);

      if (!label || !cookie) return null;
      return { label, cookie };
    })
    .filter(Boolean);
}

runBtn.addEventListener('click', async () => {
  output.textContent = '';
  const cmd = commandInput.value.trim();
  if (!cmd) {
    append('Please enter a command.');
    return;
  }

  const accounts = parseAccounts(accountsTextarea.value);
  if (!accounts.length) {
    append('Please add at least one account line in the format: Label|.ROBLOSECURITY cookie');
    return;
  }

  append(`Running "${cmd}" for ${accounts.length} account(s)...`);
  runBtn.disabled = true;

  try {
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accounts, command: cmd })
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      append(`Server error (${res.status}): ${txt}`);
    } else {
      const data = await res.json();
      if (Array.isArray(data.results)) {
        for (const r of data.results) {
          if (r.ok) {
            append(`✔ ${r.label}: ${r.message}`);
          } else {
            append(`✖ ${r.label}: ${r.message}`);
          }
        }
      } else {
        append('Unexpected server response.');
      }
    }
  } catch (e) {
    append(`Request failed: ${e.message || e}`);
  } finally {
    runBtn.disabled = false;
  }
});
