let canEdit = false;
let phoneData = { sections: [] };
let modalCallback = null;

async function init() {
    const [sessionRes, dataRes] = await Promise.all([
        fetch('/session'),
        fetch('/api/phone-list')
    ]);

    if (!sessionRes.ok) { window.location.href = '/login.html'; return; }

    const session = await sessionRes.json();
    canEdit = session.role === 'admin' || session.adminAccess === true;

    const dashUrl = session.role === 'admin' ? '/admin_dashboard.html'
                  : session.role === 'manager' ? '/manager_dashboard.html'
                  : '/dashboard.html';
    document.getElementById('back-link').href = dashUrl;
    document.getElementById('brand-link').href = dashUrl;

    if (dataRes.ok) phoneData = await dataRes.json();

    if (canEdit) document.getElementById('pl-toolbar').style.display = '';

    render();
}

function render() {
    const container = document.getElementById('pl-content');
    if (!phoneData.sections || phoneData.sections.length === 0) {
        container.innerHTML = '<p class="pl-loading">No entries yet.</p>';
        return;
    }
    container.innerHTML = phoneData.sections.map(renderSection).join('');
}

function renderSection(section) {
    const editBtns = canEdit ? `
        <div class="pl-section-actions">
            <button class="pl-btn pl-btn-section" onclick="editSection('${section.id}')">Rename</button>
            <button class="pl-btn pl-btn-delete pl-btn-section" onclick="deleteSection('${section.id}')">Delete</button>
        </div>` : '';

    const addRow = canEdit ? `
        <tr class="pl-add-row">
            <td colspan="${canEdit ? 7 : 6}">
                <button class="pl-btn pl-btn-add" onclick="addEntry('${section.id}')">+ Add Entry</button>
            </td>
        </tr>` : '';

    const actionTh = canEdit ? '<th class="pl-actions-col"></th>' : '';

    return `
        <div class="pl-section">
            <div class="pl-section-header">
                <span class="pl-section-title">${esc(section.title)}</span>
                ${editBtns}
            </div>
            <table class="pl-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Position</th>
                        <th>Internal</th>
                        <th>Direct</th>
                        <th>Mobile</th>
                        <th>Email</th>
                        ${actionTh}
                    </tr>
                </thead>
                <tbody>
                    ${section.entries.map(renderEntry).join('')}
                    ${addRow}
                </tbody>
            </table>
        </div>`;
}

function renderEntry(entry) {
    const email = entry.email
        ? `<a href="mailto:${esc(entry.email)}">${esc(entry.email)}</a>`
        : '<span style="color:var(--mid)">—</span>';

    const actionTd = canEdit ? `
        <td class="pl-actions-col">
            <button class="pl-btn pl-btn-edit" onclick="editEntry('${entry.id}')">Edit</button>
            <button class="pl-btn pl-btn-delete" onclick="deleteEntry('${entry.id}')">✕</button>
        </td>` : '';

    return `
        <tr>
            <td>${esc(entry.name)}</td>
            <td>${esc(entry.position) || '<span style="color:var(--mid)">—</span>'}</td>
            <td>${esc(entry.internal) || '<span style="color:var(--mid)">—</span>'}</td>
            <td>${esc(entry.direct) || '<span style="color:var(--mid)">—</span>'}</td>
            <td>${esc(entry.mobile) || '<span style="color:var(--mid)">—</span>'}</td>
            <td>${email}</td>
            ${actionTd}
        </tr>`;
}

function esc(s) {
    if (!s) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Modal ────────────────────────────────────────────────────────────────────

function openModal(title, fields, onSave) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-fields').innerHTML = fields.map(f => `
        <div class="pl-modal-field">
            <label>${f.label}</label>
            <input type="text" name="${f.name}" value="${esc(f.value || '')}" placeholder="${esc(f.placeholder || '')}" />
        </div>`).join('');
    modalCallback = onSave;
    document.getElementById('modal-overlay').style.display = '';
    document.querySelector('#modal-fields input')?.focus();
}

function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
    modalCallback = null;
}

document.getElementById('modal-cancel').addEventListener('click', closeModal);

document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
});

document.getElementById('modal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    if (modalCallback) await modalCallback(data);
});

// ── Actions ──────────────────────────────────────────────────────────────────

document.getElementById('add-section-btn').addEventListener('click', () => {
    openModal('Add Section', [
        { label: 'Section Title', name: 'title', placeholder: 'e.g. Traffic' }
    ], async (data) => {
        const res = await fetch('/api/phone-list/section', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            phoneData.sections.push(await res.json());
            render();
            closeModal();
        }
    });
});

function editSection(sectionId) {
    const sec = phoneData.sections.find(s => s.id === sectionId);
    if (!sec) return;
    openModal('Rename Section', [
        { label: 'Title', name: 'title', value: sec.title }
    ], async (data) => {
        const res = await fetch(`/api/phone-list/section/${sectionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) { sec.title = data.title; render(); closeModal(); }
    });
}

async function deleteSection(sectionId) {
    const sec = phoneData.sections.find(s => s.id === sectionId);
    if (!confirm(`Delete section "${sec?.title}" and all its entries?`)) return;
    const res = await fetch(`/api/phone-list/section/${sectionId}`, { method: 'DELETE' });
    if (res.ok) {
        phoneData.sections = phoneData.sections.filter(s => s.id !== sectionId);
        render();
    }
}

function addEntry(sectionId) {
    openModal('Add Entry', entryFields({}), async (data) => {
        const res = await fetch(`/api/phone-list/section/${sectionId}/entry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            const entry = await res.json();
            const sec = phoneData.sections.find(s => s.id === sectionId);
            if (sec) sec.entries.push(entry);
            render();
            closeModal();
        }
    });
}

function editEntry(entryId) {
    let entry;
    for (const sec of phoneData.sections) {
        entry = sec.entries.find(e => e.id === entryId);
        if (entry) break;
    }
    if (!entry) return;
    openModal('Edit Entry', entryFields(entry), async (data) => {
        const res = await fetch(`/api/phone-list/entry/${entryId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) { Object.assign(entry, data); render(); closeModal(); }
    });
}

async function deleteEntry(entryId) {
    if (!confirm('Delete this entry?')) return;
    const res = await fetch(`/api/phone-list/entry/${entryId}`, { method: 'DELETE' });
    if (res.ok) {
        for (const sec of phoneData.sections) {
            sec.entries = sec.entries.filter(e => e.id !== entryId);
        }
        render();
    }
}

function entryFields(entry) {
    return [
        { label: 'Name',         name: 'name',     value: entry.name,     placeholder: 'Full name' },
        { label: 'Position',     name: 'position', value: entry.position, placeholder: 'Job title' },
        { label: 'Internal Ext', name: 'internal', value: entry.internal, placeholder: '3302' },
        { label: 'Direct Line',  name: 'direct',   value: entry.direct,   placeholder: '371002' },
        { label: 'Mobile',       name: 'mobile',   value: entry.mobile,   placeholder: '07xxx xxxxxx' },
        { label: 'Email',        name: 'email',    value: entry.email,    placeholder: 'name@bassett-group.co.uk' }
    ];
}

init();
