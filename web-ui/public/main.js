const form = document.getElementById('unwrapForm');
const responseContainer = document.getElementById('responseContainer');
const responseDiv = document.getElementById('response');
const copyButton = document.getElementById('copyButton');
const viewSwitch = document.getElementById('viewSwitch');
const viewLabel = document.getElementById('viewLabel');

let responseData = null;

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = document.getElementById('token').value;

    try {
        const response = await fetch('/api/unwrap', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token }),
        });

        const result = await response.json();

        if (result.success) {
            responseData = JSON.parse(result.data);
            copyButton.style.display = '';
            updateView();
            responseContainer.style.display = 'block';
        } else {
            responseDiv.textContent = `Error: ${result.error}`;
            responseContainer.style.display = 'block';
            copyButton.style.display = 'none';
        }
    } catch (error) {
        responseDiv.textContent = `Error: ${error.message}`;
        responseContainer.style.display = 'block';
        copyButton.style.display = 'none';
    }
});

copyButton.addEventListener('click', () => {
    const textArea = document.createElement('textarea');
    textArea.value = responseDiv.textContent;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    alert('Copied to clipboard!');
});

viewSwitch.addEventListener('change', updateView);

function updateView() {
    if (viewSwitch.checked) {
        // Table view
        viewLabel.textContent = 'Table';
        const table = createTable(responseData);
        responseDiv.innerHTML = '';
        responseDiv.appendChild(table);
    } else {
        // JSON view
        viewLabel.textContent = 'JSON';
        responseDiv.textContent = JSON.stringify(responseData, null, 2);
    }
}

function createTable(data) {
    const table = document.createElement('table');
    const headerRow = table.insertRow();
    const keyHeader = headerRow.insertCell(0);
    const valueHeader = headerRow.insertCell(1);
    keyHeader.textContent = 'Key';
    valueHeader.textContent = 'Value';

    for (const [key, value] of Object.entries(data)) {
        const row = table.insertRow();
        const keyCell = row.insertCell(0);
        const valueCell = row.insertCell(1);
        keyCell.textContent = key;
        valueCell.textContent = formatValue(value);
    }

    return table;
}

function formatValue(value) {
    if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value);
    }
    return value;
}

// Info popup with the curl hint
const infoIcon = document.getElementById('infoIcon');
const infoPopup = document.getElementById('infoPopup');

infoIcon.addEventListener('click', (e) => {
    e.preventDefault();
    infoPopup.style.display = infoPopup.style.display === 'block' ? 'none' : 'block';
});

document.addEventListener('click', (e) => {
    if (e.target !== infoIcon && !infoPopup.contains(e.target)) {
        infoPopup.style.display = 'none';
    }
});
