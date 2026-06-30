const form = document.getElementById('unwrapForm');
const tokenInput = document.getElementById('token');
const responseContainer = document.getElementById('responseContainer');
const resultsActions = document.getElementById('resultsActions');
const tableView = document.getElementById('tableView');
const jsonView = document.getElementById('jsonView');
const errorView = document.getElementById('errorView');
const tableViewBtn = document.getElementById('tableViewBtn');
const jsonViewBtn = document.getElementById('jsonViewBtn');
const revealJsonButton = document.getElementById('revealJsonButton');
const copyAllButton = document.getElementById('copyAllButton');
const submitButton = form.querySelector('button[type="submit"]');
const toast = document.getElementById('toast');

// Fixed-length mask so the hidden value never leaks its real length.
const MASK = '••••••••';

let responseData = null;
let currentView = 'table';
let revealedKeys = new Set(); // table: which field values are currently shown
let jsonRevealed = false;     // json: whether all values are currently shown

// ---- Clipboard helper (modern API with a graceful fallback) ----
async function copyText(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (e) {
        // fall through to legacy method
    }
    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textArea);
        return ok;
    } catch (e) {
        return false;
    }
}

let toastTimer = null;
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

// ---- Form submission ----
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = tokenInput.value.trim();
    if (!token) return;

    submitButton.disabled = true;
    submitButton.textContent = 'Unwrapping…';

    try {
        const response = await fetch('/api/unwrap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        });

        const result = await response.json();

        if (result.success) {
            responseData = JSON.parse(result.data);
            showSecret();
        } else {
            showError(result.error);
        }
    } catch (error) {
        showError(error.message);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Unwrap secret';
        responseContainer.style.display = 'block';
    }
});

function showError(message) {
    responseData = null;
    resultsActions.style.display = 'none';
    tableView.style.display = 'none';
    jsonView.style.display = 'none';
    errorView.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'error-box';
    box.textContent = `Could not unwrap this token: ${message}`;
    errorView.appendChild(box);
}

function showSecret() {
    errorView.innerHTML = '';
    resultsActions.style.display = 'flex';
    // Always start with everything hidden on a fresh unwrap.
    revealedKeys = new Set();
    jsonRevealed = false;
    setView('table');
    renderTable();
    renderJson();
}

// ---- View toggle ----
function setView(view) {
    currentView = view;
    const isTable = view === 'table';
    tableView.style.display = isTable ? 'block' : 'none';
    jsonView.style.display = isTable ? 'none' : 'block';
    tableViewBtn.classList.toggle('active', isTable);
    jsonViewBtn.classList.toggle('active', !isTable);
    // The global reveal toggle only applies to the JSON view.
    revealJsonButton.style.display = isTable ? 'none' : 'inline-flex';
}

tableViewBtn.addEventListener('click', () => setView('table'));
jsonViewBtn.addEventListener('click', () => setView('json'));

// ---- Table rendering with per-value reveal + copy ----
function renderTable() {
    tableView.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'secret-table';
    const tbody = document.createElement('tbody');

    const entries = Object.entries(responseData);
    if (entries.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 3;
        cell.textContent = 'This secret is empty.';
    }

    for (const [key, rawValue] of entries) {
        const value = formatValue(rawValue);
        const revealed = revealedKeys.has(key);
        const row = tbody.insertRow();

        const nameCell = row.insertCell();
        nameCell.className = 'field-name';
        nameCell.textContent = key;

        const valueCell = row.insertCell();
        valueCell.className = revealed ? 'field-value' : 'field-value masked';
        valueCell.textContent = revealed ? value : MASK;

        const actionCell = row.insertCell();
        actionCell.className = 'field-action';
        const group = document.createElement('div');
        group.className = 'action-group';
        group.appendChild(makeRevealButton(key));
        group.appendChild(makeCopyButton(value));
        actionCell.appendChild(group);
    }

    table.appendChild(tbody);
    tableView.appendChild(table);
}

function makeRevealButton(key) {
    const revealed = revealedKeys.has(key);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = revealed ? 'cell-btn revealed' : 'cell-btn';
    button.textContent = revealed ? 'Hide' : 'Reveal';
    button.addEventListener('click', () => {
        if (revealedKeys.has(key)) {
            revealedKeys.delete(key);
        } else {
            revealedKeys.add(key);
        }
        renderTable();
    });
    return button;
}

function makeCopyButton(value) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cell-btn';
    button.textContent = 'Copy';
    button.addEventListener('click', async () => {
        // Copies the real value even while it is masked on screen.
        const ok = await copyText(value);
        if (ok) {
            button.textContent = 'Copied';
            button.classList.add('copied');
            showToast('Value copied to clipboard');
            setTimeout(() => {
                button.textContent = 'Copy';
                button.classList.remove('copied');
            }, 1500);
        } else {
            showToast('Could not copy');
        }
    });
    return button;
}

function formatValue(value) {
    if (value === null) return 'null';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
}

// ---- JSON rendering with a single reveal toggle ----
function renderJson() {
    let obj;
    if (jsonRevealed) {
        obj = responseData;
    } else {
        obj = {};
        for (const key of Object.keys(responseData)) {
            obj[key] = MASK;
        }
    }
    jsonView.textContent = JSON.stringify(obj, null, 2);
    revealJsonButton.textContent = jsonRevealed ? 'Hide secrets' : 'Reveal secrets';
    revealJsonButton.classList.toggle('revealed', jsonRevealed);
}

revealJsonButton.addEventListener('click', () => {
    jsonRevealed = !jsonRevealed;
    renderJson();
});

// ---- Copy all (always the real values) ----
copyAllButton.addEventListener('click', async () => {
    if (!responseData) return;
    const ok = await copyText(JSON.stringify(responseData, null, 2));
    showToast(ok ? 'All values copied to clipboard' : 'Could not copy');
});

// ---- Help (curl) toggle ----
const helpToggle = document.getElementById('helpToggle');
const helpBox = document.getElementById('helpBox');

helpToggle.addEventListener('click', () => {
    const open = helpBox.style.display === 'block';
    helpBox.style.display = open ? 'none' : 'block';
    helpToggle.textContent = open
        ? 'Prefer the command line? Show curl command'
        : 'Hide curl command';
});
