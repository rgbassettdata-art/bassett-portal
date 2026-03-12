(function () {
    let allUsers = [];

    // ── Helpers ──────────────────────────────────────────────────────────────

    function setMsg(el, text, type) {
        el.textContent = text;
        el.className = 'admin-msg ' + (type || '');
    }

    function managers() {
        return allUsers.filter(u => u.role === 'manager');
    }

    function approvers() {
        return allUsers.filter(u => u.role === 'manager' || u.role === 'admin');
    }

    // ── Render table ─────────────────────────────────────────────────────────

    function renderTable() {
        const tbody = document.getElementById('users-tbody');
        tbody.innerHTML = '';

        if (allUsers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="13" class="admin-loading">No users found.</td></tr>';
            return;
        }

        [...allUsers].sort((a, b) => a.username.localeCompare(b.username)).forEach(u => {
            const tr = document.createElement('tr');
            tr.dataset.username = u.username;

            // username
            const tdName = document.createElement('td');
            tdName.textContent = u.username;

            // role badge
            const tdRole = document.createElement('td');
            tdRole.innerHTML = '<span class="role-badge role-' + u.role + '">' + u.role + '</span>';

            // clock number (employees and managers only)
            const tdClock = document.createElement('td');
            if (u.role === 'employee' || u.role === 'manager') {
                const inp = document.createElement('input');
                inp.type = 'text';
                inp.value = u.clockNumber || '';
                inp.placeholder = '—';
                inp.dataset.field = 'clockNumber';
                inp.style.cssText = 'width:80px;font-family:inherit;font-size:0.85rem;color:var(--dark);background:var(--off-white);border:1.5px solid var(--border);padding:0.3rem 0.5rem;outline:none;';
                inp.addEventListener('input', () => markDirty(tr));
                tdClock.appendChild(inp);
            } else {
                tdClock.textContent = '—';
                tdClock.style.color = 'var(--mid)';
            }

            // email address
            const tdEmail = document.createElement('td');
            const emailInp = document.createElement('input');
            emailInp.type = 'email';
            emailInp.value = u.email || '';
            emailInp.placeholder = 'email@example.com';
            emailInp.dataset.field = 'email';
            emailInp.style.cssText = 'width:180px;font-family:inherit;font-size:0.85rem;color:var(--dark);background:var(--off-white);border:1.5px solid var(--border);padding:0.3rem 0.5rem;outline:none;';
            emailInp.addEventListener('input', () => markDirty(tr));
            tdEmail.appendChild(emailInp);

            // department (employees and managers only)
            const DEPARTMENTS = ['Driver - Artic','Driver - Rigid','Night Drivers','Bargh Drivers','Warehouse','Training','Admin','Salaried Staff','Finance','Workshop','Workshop Admin'];
            const tdDept = document.createElement('td');
            if (u.role === 'employee' || u.role === 'manager') {
                const sel = document.createElement('select');
                sel.dataset.field = 'department';
                const none = document.createElement('option');
                none.value = '';
                none.textContent = '— none —';
                sel.appendChild(none);
                DEPARTMENTS.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d;
                    opt.textContent = d;
                    if (u.department === d) opt.selected = true;
                    sel.appendChild(opt);
                });
                sel.addEventListener('change', () => markDirty(tr));
                tdDept.appendChild(sel);
            } else {
                tdDept.textContent = '—';
                tdDept.style.color = 'var(--mid)';
            }

            // colour (employees and managers only)
            const tdColour = document.createElement('td');
            if (u.role === 'employee' || u.role === 'manager') {
                const inp = document.createElement('input');
                inp.type = 'color';
                inp.value = u.colour || '#4A90D9';
                inp.dataset.field = 'colour';
                inp.title = 'Calendar colour';
                inp.style.cssText = 'width:32px;height:28px;padding:2px;border:1.5px solid var(--border);background:none;cursor:pointer;';
                inp.addEventListener('input', () => markDirty(tr));
                tdColour.appendChild(inp);
            } else {
                tdColour.textContent = '—';
                tdColour.style.color = 'var(--mid)';
            }

            // manager assignment (employees only)
            const tdManager = document.createElement('td');
            if (u.role === 'employee') {
                const sel = document.createElement('select');
                sel.dataset.field = 'manager';
                const none = document.createElement('option');
                none.value = '';
                none.textContent = '— unassigned —';
                sel.appendChild(none);
                managers().forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.username;
                    opt.textContent = m.username;
                    if (u.manager === m.username) opt.selected = true;
                    sel.appendChild(opt);
                });
                sel.addEventListener('change', () => markDirty(tr));
                tdManager.appendChild(sel);
            } else {
                tdManager.textContent = '—';
                tdManager.style.color = 'var(--mid)';
            }

            // approver assignment (managers only — who approves their holiday requests)
            const tdApprover = document.createElement('td');
            if (u.role === 'manager') {
                const sel = document.createElement('select');
                sel.dataset.field = 'approver';
                const none = document.createElement('option');
                none.value = '';
                none.textContent = '— unassigned —';
                sel.appendChild(none);
                approvers().filter(a => a.username !== u.username).forEach(a => {
                    const opt = document.createElement('option');
                    opt.value = a.username;
                    opt.textContent = a.username + ' (' + a.role + ')';
                    if (u.approver === a.username) opt.selected = true;
                    sel.appendChild(opt);
                });
                sel.addEventListener('change', () => markDirty(tr));
                tdApprover.appendChild(sel);
            } else {
                tdApprover.textContent = '—';
                tdApprover.style.color = 'var(--mid)';
            }

            // admin access toggle (managers only)
            const tdAdminAccess = document.createElement('td');
            if (u.role === 'manager') {
                const label = document.createElement('label');
                label.className = 'toggle-switch';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.dataset.field = 'adminAccess';
                checkbox.checked = !!u.adminAccess;
                checkbox.addEventListener('change', () => markDirty(tr));
                const slider = document.createElement('span');
                slider.className = 'toggle-slider';
                label.appendChild(checkbox);
                label.appendChild(slider);
                tdAdminAccess.appendChild(label);
            } else {
                tdAdminAccess.textContent = '—';
                tdAdminAccess.style.color = 'var(--mid)';
            }

            // this year allowance (employees and managers only)
            const tdHols = document.createElement('td');
            if (u.role === 'employee' || u.role === 'manager') {
                const inp = document.createElement('input');
                inp.type = 'number';
                inp.min = 0;
                inp.max = 365;
                inp.value = u.totalHolidays;
                inp.dataset.field = 'totalHolidays';
                inp.addEventListener('input', () => markDirty(tr));
                tdHols.appendChild(inp);
            } else {
                tdHols.textContent = '—';
                tdHols.style.color = 'var(--mid)';
            }

            // next year allowance (employees and managers only)
            const tdNextYear = document.createElement('td');
            if (u.role === 'employee' || u.role === 'manager') {
                const inp = document.createElement('input');
                inp.type = 'number';
                inp.min = 0;
                inp.max = 365;
                inp.value = u.nextYearHolidays ?? u.totalHolidays ?? 28;
                inp.dataset.field = 'nextYearHolidays';
                inp.addEventListener('input', () => markDirty(tr));
                tdNextYear.appendChild(inp);
            } else {
                tdNextYear.textContent = '—';
                tdNextYear.style.color = 'var(--mid)';
            }

            // work days picker (employees and managers only)
            const tdWorkDays = document.createElement('td');
            if (u.role === 'employee' || u.role === 'manager') {
                const userWorkDays = u.workDays || [1,2,3,4,5];
                const wrap = document.createElement('div');
                wrap.className = 'wd-picker';
                wrap.dataset.field = 'workDays';
                const labels = ['M','Tu','W','Th','F','Sa','Su'];
                const nums   = [1,2,3,4,5,6,0];
                labels.forEach(function (lbl, i) {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.textContent = lbl;
                    btn.dataset.day = nums[i];
                    btn.className = 'wd-btn' + (userWorkDays.indexOf(nums[i]) !== -1 ? ' wd-active' : '');
                    btn.addEventListener('click', function () {
                        btn.classList.toggle('wd-active');
                        markDirty(tr);
                    });
                    wrap.appendChild(btn);
                });
                tdWorkDays.appendChild(wrap);
            } else {
                tdWorkDays.textContent = '—';
                tdWorkDays.style.color = 'var(--mid)';
            }

            // actions
            const tdActions = document.createElement('td');
            tdActions.className = 'td-actions';

            const saveBtn = document.createElement('button');
            saveBtn.className = 'admin-btn admin-btn-save';
            saveBtn.textContent = 'Save';
            saveBtn.disabled = true;
            saveBtn.dataset.action = 'save';
            saveBtn.addEventListener('click', () => saveRow(tr, saveBtn));

            const delBtn = document.createElement('button');
            delBtn.className = 'admin-btn admin-btn-delete';
            delBtn.textContent = 'Delete';
            delBtn.dataset.action = 'delete';
            delBtn.addEventListener('click', () => deleteUser(u.username, tr));

            if (u.role === 'employee' || u.role === 'manager') {
                tdActions.appendChild(saveBtn);
            }
            tdActions.appendChild(delBtn);

            tr.appendChild(tdName);
            tr.appendChild(tdRole);
            tr.appendChild(tdClock);
            tr.appendChild(tdEmail);
            tr.appendChild(tdDept);
            tr.appendChild(tdColour);
            tr.appendChild(tdManager);
            tr.appendChild(tdApprover);
            tr.appendChild(tdAdminAccess);
            tr.appendChild(tdHols);
            tr.appendChild(tdNextYear);
            tr.appendChild(tdWorkDays);
            tr.appendChild(tdActions);
            tbody.appendChild(tr);
        });
    }

    function markDirty(tr) {
        const saveBtn = tr.querySelector('[data-action="save"]');
        if (saveBtn) saveBtn.disabled = false;
    }

    // ── Save row ──────────────────────────────────────────────────────────────

    function saveRow(tr, btn) {
        const username = tr.dataset.username;
        const payload = {};

        const clockInp = tr.querySelector('[data-field="clockNumber"]');
        if (clockInp) payload.clockNumber = clockInp.value.trim() || null;

        const emailInp = tr.querySelector('[data-field="email"]');
        if (emailInp) payload.email = emailInp.value.trim() || null;

        const deptSel = tr.querySelector('[data-field="department"]');
        if (deptSel) payload.department = deptSel.value;

        const colourInp = tr.querySelector('[data-field="colour"]');
        if (colourInp) payload.colour = colourInp.value;

        const managerSel = tr.querySelector('[data-field="manager"]');
        if (managerSel) payload.manager = managerSel.value;

        const approverSel = tr.querySelector('[data-field="approver"]');
        if (approverSel) payload.approver = approverSel.value;

        const adminAccessChk = tr.querySelector('[data-field="adminAccess"]');
        if (adminAccessChk) payload.adminAccess = adminAccessChk.checked;

        const holsInp = tr.querySelector('[data-field="totalHolidays"]');
        if (holsInp) payload.totalHolidays = parseInt(holsInp.value, 10);

        const nextYearInp = tr.querySelector('[data-field="nextYearHolidays"]');
        if (nextYearInp) payload.nextYearHolidays = parseInt(nextYearInp.value, 10);

        const wdPicker = tr.querySelector('[data-field="workDays"]');
        if (wdPicker) {
            payload.workDays = Array.from(wdPicker.querySelectorAll('.wd-btn.wd-active'))
                .map(function (b) { return parseInt(b.dataset.day, 10); });
        }

        btn.disabled = true;
        btn.textContent = 'Saving…';

        fetch('/user/' + encodeURIComponent(username), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        .then(r => r.json())
        .then(data => {
            btn.textContent = data.success ? 'Saved ✓' : 'Error';
            if (data.success) {
                const u = allUsers.find(u => u.username === username);
                if (u) {
                    if (payload.manager !== undefined)       u.manager = payload.manager || null;
                    if (payload.totalHolidays !== undefined) u.totalHolidays = payload.totalHolidays;
                }
                setTimeout(() => { btn.textContent = 'Save'; }, 2000);
            }
        })
        .catch(() => { btn.textContent = 'Error'; });
    }

    // ── Delete user ───────────────────────────────────────────────────────────

    function deleteUser(username, tr) {
        if (!confirm('Delete user "' + username + '"? This cannot be undone.')) return;

        fetch('/user/' + encodeURIComponent(username), { method: 'DELETE' })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                allUsers = allUsers.filter(u => u.username !== username);
                tr.remove();
                // re-render so manager dropdowns update
                renderTable();
            } else {
                alert(data.error || 'Could not delete user.');
            }
        })
        .catch(() => alert('Request failed.'));
    }

    // ── Create user form ──────────────────────────────────────────────────────

    document.getElementById('create-user-form').addEventListener('submit', function (e) {
        e.preventDefault();
        const msg = document.getElementById('create-msg');
        const username   = this.username.value.trim();
        const password   = this.password.value;
        const role       = this.role.value;
        const department = null;

        setMsg(msg, 'Creating…', '');

        fetch('/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role }),
        })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                setMsg(msg, 'User "' + username + '" created.', 'success');
                this.reset();
                loadUsers();
            } else {
                setMsg(msg, data.error || 'Failed to create user.', 'error');
            }
        })
        .catch(() => setMsg(msg, 'Request failed.', 'error'));
    });

    // ── Load users ────────────────────────────────────────────────────────────

    function loadUsers() {
        fetch('/admin/users')
        .then(r => r.json())
        .then(data => {
            allUsers = data;
            renderTable();
        })
        .catch(() => {
            document.getElementById('users-tbody').innerHTML =
                '<tr><td colspan="5" class="admin-loading">Could not load users.</td></tr>';
        });
    }

    loadUsers();

    // ── Holiday Request Audit ─────────────────────────────────────────────────

    var allAuditReqs = [];

    var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    function fmtDay(s) {
        if (!s) return '—';
        var p = s.split('-');
        return p[2] + ' ' + MONTHS[parseInt(p[1], 10) - 1] + ' ' + p[0];
    }

    function fmtDate(iso) {
        if (!iso) return '—';
        var d = new Date(iso);
        return String(d.getDate()).padStart(2, '0') + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    }

    function auditStatusBadge(s) {
        var colours = {
            pending:   '#e8a020',
            approved:  '#25764A',
            declined:  '#c0392b',
            cancelled: '#888',
            removed:   '#888',
        };
        var c = colours[s] || '#888';
        return '<span class="role-badge" style="background:' + c + '22;color:' + c + '">' + s + '</span>';
    }

    function renderAudit(reqs) {
        var tbody = document.getElementById('audit-tbody');
        if (reqs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="admin-loading">No requests found.</td></tr>';
            return;
        }
        tbody.innerHTML = '';
        reqs.forEach(function (r) {
            var decidedCell = r.decidedBy
                ? r.decidedBy + '<br><small class="audit-date">' + fmtDate(r.decidedAt) + '</small>'
                : '—';
            var amendedCell = r.amendedBy
                ? r.amendedBy + '<br><small class="audit-date">' + fmtDate(r.amendedAt) + '</small>'
                : '—';
            var endedCell = '—';
            if (r.cancelledBy)
                endedCell = 'Cancelled by ' + r.cancelledBy + '<br><small class="audit-date">' + fmtDate(r.cancelledAt) + '</small>';
            else if (r.removedBy)
                endedCell = 'Removed by ' + r.removedBy + '<br><small class="audit-date">' + fmtDate(r.removedAt) + '</small>';

            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td>' + r.username                    + '</td>' +
                '<td>' + (r.department || '—')         + '</td>' +
                '<td>' + fmtDay(r.startDate)            + '</td>' +
                '<td>' + fmtDay(r.endDate)              + '</td>' +
                '<td>' + r.days                        + '</td>' +
                '<td>' + auditStatusBadge(r.status)    + '</td>' +
                '<td>' + fmtDate(r.requestedAt)        + '</td>' +
                '<td>' + decidedCell                   + '</td>' +
                '<td>' + amendedCell                   + '</td>' +
                '<td>' + endedCell                     + '</td>';
            tbody.appendChild(tr);
        });
    }

    function applyAuditFilter() {
        var filter = document.getElementById('audit-filter').value;
        renderAudit(filter ? allAuditReqs.filter(function (r) { return r.status === filter; }) : allAuditReqs);
    }

    function loadAudit() {
        fetch('/admin/holiday-requests')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                allAuditReqs = data;
                applyAuditFilter();
            })
            .catch(function () {
                document.getElementById('audit-tbody').innerHTML =
                    '<tr><td colspan="10" class="admin-loading">Could not load audit data.</td></tr>';
            });
    }

    document.getElementById('audit-filter').addEventListener('change', applyAuditFilter);

    loadAudit();

    // ── Absence Log ──────────────────────────────────────────────────────────
    function renderAbsenceLog(absences) {
        var tbody = document.getElementById('absence-log-tbody');
        if (!tbody) return;
        if (absences.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="admin-loading">No absence records.</td></tr>';
            return;
        }
        tbody.innerHTML = '';
        absences.forEach(function (a) {
            var removedCell = a.removedBy
                ? a.removedBy + '<br><small class="audit-date">' + fmtDate(a.updatedAt || '') + '</small>'
                : '—';
            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td>' + a.username                                                              + '</td>' +
                '<td>' + (a.department || '—')                                                   + '</td>' +
                '<td>' + fmtDay(a.startDate)                                                     + '</td>' +
                '<td>' + fmtDay(a.endDate)                                                       + '</td>' +
                '<td style="color:var(--mid);font-size:0.82rem;">' + (a.reason || '—')          + '</td>' +
                '<td>' + (a.createdBy || '—')                                                    + '</td>' +
                '<td>' + fmtDate(a.createdAt)                                                    + '</td>' +
                '<td>' + removedCell                                                             + '</td>';
            tbody.appendChild(tr);
        });
    }

    function loadAbsenceLog() {
        fetch('/admin/absences')
            .then(function (r) { return r.json(); })
            .then(function (data) { renderAbsenceLog(data); })
            .catch(function () {
                var tbody = document.getElementById('absence-log-tbody');
                if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="admin-loading">Could not load absence data.</td></tr>';
            });
    }

    loadAbsenceLog();

    // ── News Management ───────────────────────────────────────────────────────

    let editingNewsId = null;
    let newsLinkCount = 0;

    function esc(s) {
        return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function fmtNewsDate(iso) {
        if (!iso) return '';
        return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function addLinkRow(label, url) {
        const wrap = document.getElementById('news-links-wrap');
        const idx  = newsLinkCount++;
        const row  = document.createElement('div');
        row.className = 'news-admin-link-row';
        row.dataset.linkIdx = idx;
        row.innerHTML = `
            <input type="text" placeholder="Label (e.g. Company Handbook)" class="nl-label" value="${esc(label || '')}" />
            <input type="url"  placeholder="URL (e.g. \\\\server\\share or https://...)" class="nl-url" value="${esc(url || '')}" />
            <button type="button" class="news-remove-link-btn" title="Remove link">&times;</button>`;
        row.querySelector('.news-remove-link-btn').addEventListener('click', () => row.remove());
        wrap.appendChild(row);
    }

    function getLinks() {
        return Array.from(document.querySelectorAll('.news-admin-link-row')).map(row => ({
            label: row.querySelector('.nl-label').value.trim(),
            url:   row.querySelector('.nl-url').value.trim(),
        })).filter(l => l.url);
    }

    function setEditorMode(editing, title) {
        const bar   = document.getElementById('news-editor-mode-bar');
        const label = document.getElementById('news-editor-label');
        if (editing) {
            bar.style.background = 'var(--orange)';
            label.textContent = 'Editing: ' + (title || 'Post');
        } else {
            bar.style.background = '';
            label.textContent = 'New Post';
        }
    }

    function resetNewsForm() {
        editingNewsId = null;
        document.getElementById('news-title').value    = '';
        document.getElementById('news-body').value     = '';
        document.getElementById('news-pinned').checked = false;
        document.getElementById('news-links-wrap').innerHTML = '';
        document.getElementById('news-submit-btn').textContent = 'Publish Post';
        document.getElementById('news-cancel-btn').style.display = 'none';
        newsLinkCount = 0;
        setEditorMode(false);
    }

    function loadNewsAdmin() {
        fetch('/api/news')
            .then(r => r.json())
            .then(posts => {
                const container = document.getElementById('news-admin-list');
                if (!posts.length) {
                    container.innerHTML = '<p style="color:var(--mid);font-size:0.85rem">No posts yet.</p>';
                    return;
                }
                container.innerHTML = posts.map(p => {
                    const linksSummary = (p.links || []).map(l => `<span>${esc(l.label || l.url)}</span>`).join(', ');
                    const pin = p.pinned ? '&#128204; ' : '';
                    return `<div class="news-admin-item" data-id="${p.id}">
                        <div class="news-admin-item-title">${pin}${esc(p.title)}</div>
                        <div class="news-admin-item-meta">Posted ${fmtNewsDate(p.createdAt)} by ${esc(p.createdBy)}${p.updatedAt !== p.createdAt ? ' &bull; edited ' + fmtNewsDate(p.updatedAt) : ''}</div>
                        ${p.body ? `<div class="news-admin-item-body">${esc(p.body)}</div>` : ''}
                        ${linksSummary ? `<div class="news-admin-item-links">Links: ${linksSummary}</div>` : ''}
                        <div class="news-admin-item-actions">
                            <button class="admin-btn news-edit-btn" data-id="${p.id}">Edit</button>
                            <button class="admin-btn admin-btn-delete news-delete-btn" data-id="${p.id}">Delete</button>
                        </div>
                    </div>`;
                }).join('');

                container.querySelectorAll('.news-edit-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const post = posts.find(p => p.id === btn.dataset.id);
                        if (!post) return;
                        editingNewsId = post.id;
                        document.getElementById('news-title').value    = post.title;
                        document.getElementById('news-body').value     = post.body || '';
                        document.getElementById('news-pinned').checked = post.pinned;
                        document.getElementById('news-links-wrap').innerHTML = '';
                        newsLinkCount = 0;
                        (post.links || []).forEach(l => addLinkRow(l.label, l.url));
                        document.getElementById('news-submit-btn').textContent = 'Save Changes';
                        document.getElementById('news-cancel-btn').style.display = '';
                        setEditorMode(true, post.title);
                        document.getElementById('news-section').scrollIntoView({ behavior: 'smooth' });
                    });
                });

                container.querySelectorAll('.news-delete-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        if (!confirm('Delete this news post?')) return;
                        fetch('/api/news/' + btn.dataset.id, { method: 'DELETE' })
                            .then(r => r.json())
                            .then(() => loadNewsAdmin())
                            .catch(() => alert('Failed to delete post.'));
                    });
                });
            })
            .catch(() => {
                document.getElementById('news-admin-list').innerHTML = '<p style="color:#c00">Could not load posts.</p>';
            });
    }

    document.getElementById('add-news-link-btn').addEventListener('click', () => addLinkRow('', ''));

    document.getElementById('news-cancel-btn').addEventListener('click', () => resetNewsForm());

    document.getElementById('news-form').addEventListener('submit', e => {
        e.preventDefault();
        const title  = document.getElementById('news-title').value.trim();
        const body   = document.getElementById('news-body').value.trim();
        const pinned = document.getElementById('news-pinned').checked;
        const links  = getLinks();
        const msg    = document.getElementById('news-msg');

        const payload = { title, body, links, pinned };
        const url     = editingNewsId ? '/api/news/' + editingNewsId : '/api/news';
        const method  = editingNewsId ? 'PATCH' : 'POST';

        fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            .then(r => r.json())
            .then(data => {
                if (data.error) { setMsg(msg, data.error, 'error'); return; }
                setMsg(msg, editingNewsId ? 'Post updated.' : 'Post published.', 'ok');
                resetNewsForm();
                loadNewsAdmin();
                setTimeout(() => { msg.textContent = ''; }, 3000);
            })
            .catch(() => setMsg(msg, 'Request failed.', 'error'));
    });

    loadNewsAdmin();
})();
