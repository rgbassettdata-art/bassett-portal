(function () {

    // ── Greeting + personal holiday stats ────────────────────────────────────
    fetch('/session')
        .then(function (r) { return r.json(); })
        .then(function (user) {
            var el = document.getElementById('mgr-greeting');
            if (el) el.textContent = 'Welcome back, ' + user.username + '. Here\'s your team summary.';

            var total = (user.totalHolidays ?? 28) + (user.carriedOver ?? 0);
            var taken = user.takenHolidays ?? 0;

            var daysLeftEl = document.getElementById('mgr-days-left');
            if (daysLeftEl) daysLeftEl.textContent = total - taken;

            var detailEl = document.getElementById('mgr-this-year-detail');
            if (detailEl) detailEl.textContent = taken + ' taken of ' + total;

            var nextBookedEl = document.getElementById('mgr-next-year-booked');
            if (nextBookedEl) nextBookedEl.textContent = user.nextYearTaken ?? 0;

            var nextDetailEl = document.getElementById('mgr-next-year-detail');
            if (nextDetailEl) {
                var nextAllow = user.nextYearHolidays ?? user.totalHolidays ?? 28;
                nextDetailEl.textContent = 'of ' + nextAllow + ' allowance';
            }
        })
        .catch(function () {});

    // ── Helpers ───────────────────────────────────────────────────────────────
    function statusBadge(s) {
        var map = { pending: '#e8a020', approved: '#25764A', declined: '#c0392b' };
        var c   = map[s] || '#888';
        return '<span class="leave-badge" style="background:' + c + '22;color:' + c + '">' + s + '</span>';
    }

    function colourDot(colour) {
        return '<span class="team-dot" style="background:' + (colour || '#888') + '"></span>';
    }

    function fmtDay(s) {
        if (!s) return '—';
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var p = s.split('-');
        return p[2] + ' ' + months[parseInt(p[1], 10) - 1] + ' ' + p[0];
    }

    // ── Build calendar highlights from approved requests ──────────────────────
    function applyCalendarHighlights(approved) {
        if (!window.YearCalendar) return;
        var h = {};
        approved.forEach(function (req) {
            var d   = new Date(req.startDate);
            var end = new Date(req.endDate);
            while (d <= end) {
                var key = d.toISOString().slice(0, 10);
                h[key] = h[key] || [];
                if (h[key].indexOf(req.colour) === -1) h[key].push(req.colour);
                d.setDate(d.getDate() + 1);
            }
        });
        window.YearCalendar.setHighlights(h);
    }

    // ── Load team + approved holidays ─────────────────────────────────────────
    var allUsers   = [];
    var allApproved = [];

    function loadTeam() {
        Promise.all([
            fetch('/users').then(function (r) { return r.json(); }),
            fetch('/holiday-requests/approved').then(function (r) { return r.json(); }),
        ]).then(function (results) {
            allUsers    = results[0];
            allApproved = results[1];

            document.getElementById('stat-headcount').textContent = allUsers.length;

            var today   = new Date().toISOString().slice(0, 10);
            var onLeave = allApproved.filter(function (req) {
                return req.startDate <= today && req.endDate >= today;
            });
            document.getElementById('stat-on-leave').textContent = onLeave.length;

            applyCalendarHighlights(allApproved);
            populateTeamDeptFilter();
            applyTeamFilter();
        }).catch(function () {});
    }

    function populateTeamDeptFilter() {
        var sel = document.getElementById('team-dept-filter');
        if (!sel) return;
        var deptSet = {};
        allUsers.forEach(function (u) { if (u.department) deptSet[u.department] = true; });
        var depts = Object.keys(deptSet).sort();
        var current = sel.value;
        sel.innerHTML = '<option value="">All</option>';
        depts.forEach(function (d) {
            var opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            if (d === current) opt.selected = true;
            sel.appendChild(opt);
        });
    }

    function applyTeamFilter() {
        var sel    = document.getElementById('team-dept-filter');
        var filter = sel ? sel.value : '';
        var users  = filter
            ? allUsers.filter(function (u) { return u.department === filter; })
            : allUsers.slice();
        users.sort(function (a, b) {
            return (a.username || '').toLowerCase().localeCompare((b.username || '').toLowerCase());
        });
        renderTeamTable(users, allApproved);
    }

    function renderTeamTable(users, approved) {
        var tbody = document.getElementById('team-table-body');
        if (!tbody) return;
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="mgr-table-empty">No team members assigned.</td></tr>';
            return;
        }
        tbody.innerHTML = '';
        users.forEach(function (u) {
            var sample       = approved.find(function (a) { return a.username === u.username; });
            var colour       = sample ? sample.colour : (u.colour || '#888');
            var total        = (u.totalHolidays !== undefined ? u.totalHolidays : 28) + (u.carriedOver || 0);
            var taken        = u.takenHolidays    !== undefined ? u.takenHolidays    : 0;
            var nextAllow    = u.nextYearHolidays !== undefined ? u.nextYearHolidays : (u.totalHolidays ?? 28);
            var nextBooked   = u.nextYearTaken    !== undefined ? u.nextYearTaken    : 0;
            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td>' + colourDot(colour) + u.username   + '</td>' +
                '<td>' + u.role                           + '</td>' +
                '<td>' + (u.department || '—')            + '</td>' +
                '<td>' + total                            + '</td>' +
                '<td>' + taken                            + '</td>' +
                '<td>' + (total - taken)                  + '</td>' +
                '<td>' + nextAllow                        + '</td>' +
                '<td>' + nextBooked                       + '</td>';
            tbody.appendChild(tr);
        });
    }

    // ── Load leave requests ───────────────────────────────────────────────────
    var allTeamReqs = [];

    function loadRequests() {
        fetch('/holiday-requests/team')
            .then(function (r) { return r.json(); })
            .then(function (reqs) {
                allTeamReqs = reqs;
                var pending = reqs.filter(function (r) { return r.status === 'pending'; });
                document.getElementById('stat-open-requests').textContent = pending.length;
                applyRequestFilter();
            })
            .catch(function () {});
    }

    function applyRequestFilter() {
        var sel    = document.getElementById('lr-status-filter');
        var filter = sel ? sel.value : 'pending';
        var reqs   = filter ? allTeamReqs.filter(function (r) { return r.status === filter; }) : allTeamReqs;
        renderRequests(reqs);
    }

    function renderRequests(reqs) {
        var tbody = document.getElementById('leave-requests-body');
        if (!tbody) return;
        if (reqs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="mgr-table-empty">No leave requests.</td></tr>';
            return;
        }
        reqs.sort(function (a, b) { return b.requestedAt.localeCompare(a.requestedAt); });
        tbody.innerHTML = '';
        reqs.forEach(function (req) { tbody.appendChild(buildRequestRow(req)); });
    }

    function buildRequestRow(req) {
        var tr = document.createElement('tr');
        tr.dataset.id = req.id;

        var actionHTML = '';
        if (req.status === 'pending') {
            actionHTML =
                '<button class="mgr-action-btn mgr-approve" data-id="' + req.id + '">Approve</button>' +
                '<button class="mgr-action-btn mgr-decline" data-id="' + req.id + '">Decline</button>' +
                '<button class="mgr-action-btn mgr-edit"    data-id="' + req.id + '">Edit</button>' +
                '<button class="mgr-action-btn mgr-remove"  data-id="' + req.id + '">Remove</button>';
        } else {
            var removeLabel = req.status === 'approved' ? 'Cancel' : 'Remove';
            actionHTML = '<button class="mgr-action-btn mgr-remove" data-id="' + req.id + '">' + removeLabel + '</button>';
        }

        tr.innerHTML =
            '<td>' + req.username  + '</td>' +
            '<td class="req-cell-from">' + fmtDay(req.startDate) + '</td>' +
            '<td class="req-cell-to">'   + fmtDay(req.endDate)   + '</td>' +
            '<td class="req-cell-days">' + req.days      + '</td>' +
            '<td>' + statusBadge(req.status) + '</td>' +
            '<td class="leave-actions">' + actionHTML + '</td>';

        var approveBtn = tr.querySelector('.mgr-approve');
        if (approveBtn) approveBtn.addEventListener('click', function () { decide(req.id, 'approved'); });

        var declineBtn = tr.querySelector('.mgr-decline');
        if (declineBtn) declineBtn.addEventListener('click', function () { decide(req.id, 'declined'); });

        var editBtn = tr.querySelector('.mgr-edit');
        if (editBtn) editBtn.addEventListener('click', function () { enterEditMode(tr, req); });

        var removeBtn = tr.querySelector('.mgr-remove');
        if (removeBtn) removeBtn.addEventListener('click', function () { removeRequest(req.id); });

        return tr;
    }

    function enterEditMode(tr, req) {
        tr.querySelector('.req-cell-from').innerHTML = '<input type="date" class="mgr-date-input" value="' + req.startDate + '">';
        tr.querySelector('.req-cell-to').innerHTML   = '<input type="date" class="mgr-date-input" value="' + req.endDate   + '">';
        tr.querySelector('.req-cell-days').textContent = '—';
        tr.querySelector('.leave-actions').innerHTML =
            '<button class="mgr-action-btn mgr-save-edit"   data-id="' + req.id + '">Save</button>' +
            '<button class="mgr-action-btn mgr-cancel-edit">Cancel</button>';

        tr.querySelector('.mgr-save-edit').addEventListener('click', function () {
            var start = tr.querySelector('.req-cell-from input').value;
            var end   = tr.querySelector('.req-cell-to input').value;
            amendRequest(req.id, start, end);
        });
        tr.querySelector('.mgr-cancel-edit').addEventListener('click', function () { loadRequests(); });
    }

    function decide(id, status) {
        fetch('/holiday-request/' + id, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: status }),
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.success) { loadRequests(); loadTeam(); if (window.HolidayMatrix) window.HolidayMatrix.reload(); }
        })
        .catch(function () {});
    }

    function amendRequest(id, startDate, endDate) {
        fetch('/holiday-request/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate: startDate, endDate: endDate }),
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.success) { loadRequests(); loadTeam(); if (window.HolidayMatrix) window.HolidayMatrix.reload(); }
            else alert(data.error || 'Could not amend request.');
        })
        .catch(function () {});
    }

    function removeRequest(id) {
        if (!confirm('Remove this holiday request? If approved, the days will be returned to the employee.')) return;
        fetch('/holiday-request/' + id, { method: 'DELETE' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.success) { loadRequests(); loadTeam(); if (window.HolidayMatrix) window.HolidayMatrix.reload(); }
            else alert(data.error || 'Could not remove request.');
        })
        .catch(function () {});
    }

    // ── Month calendar: approved + pending with employee colours ─────────────
    function loadMonthCalendar() {
        if (!window.MonthCalendar) return;
        Promise.all([
            fetch('/users').then(function (r) { return r.json(); }),
            fetch('/holiday-requests/team').then(function (r) { return r.json(); }),
        ]).then(function (results) {
            var users   = results[0];
            var allReqs = results[1];

            var colourMap = {};
            users.forEach(function (u) { colourMap[u.username] = u.colour || '#888'; });

            var h = {};
            allReqs.forEach(function (req) {
                if (req.status !== 'approved' && req.status !== 'pending') return;
                var colour = colourMap[req.username] || '#888';
                var d   = new Date(req.startDate);
                var end = new Date(req.endDate);
                while (d <= end) {
                    var key = d.toISOString().slice(0, 10);
                    h[key] = h[key] || [];
                    h[key].push({ colour: colour, status: req.status });
                    d.setDate(d.getDate() + 1);
                }
            });

            window.MonthCalendar.setHighlights(h);
        }).catch(function () {});
    }

    // ── Book holiday form ─────────────────────────────────────────────────────
    var sessionUsername = '';

    fetch('/session')
        .then(function (r) { return r.json(); })
        .then(function (user) {
            sessionUsername = user.username;
            if (user.adminAccess) {
                var link = document.getElementById('admin-panel-link');
                if (link) link.style.display = '';
            }
            if (window.YearCalendar && user.workDays) window.YearCalendar.setWorkDays(user.workDays);
        })
        .catch(function () {});

    function populateBookFor(users) {
        var sel = document.getElementById('book-for');
        if (!sel) return;
        sel.innerHTML = '';
        users.forEach(function (u) {
            var opt = document.createElement('option');
            opt.value = u.username;
            opt.textContent = u.username;
            sel.appendChild(opt);
        });
    }

    var bookSubmit = document.getElementById('book-submit');
    if (bookSubmit) {
        bookSubmit.addEventListener('click', function () {
            var sel   = document.getElementById('book-for');
            var start = document.getElementById('book-start').value;
            var end   = document.getElementById('book-end').value;
            var msg   = document.getElementById('book-msg');
            if (!start || !end) { msg.textContent = 'Please select both dates.'; msg.className = 'req-msg req-msg-err'; return; }
            if (end < start)    { msg.textContent = 'End date must be on or after start date.'; msg.className = 'req-msg req-msg-err'; return; }

            var forVal = sel ? sel.value : '';
            var body   = { startDate: start, endDate: end };
            if (forVal) body.targetUsername = forVal;

            msg.textContent = 'Booking…';
            msg.className = 'req-msg';

            fetch('/holiday-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.success) {
                    msg.textContent = 'Holiday booked successfully.';
                    msg.className = 'req-msg req-msg-ok';
                    document.getElementById('book-start').value = '';
                    document.getElementById('book-end').value   = '';
                    loadRequests();
                    loadMyRequests();
                    loadTeam();
                    if (window.HolidayMatrix) window.HolidayMatrix.reload();
                } else {
                    msg.textContent = data.error || 'Failed to book holiday.';
                    msg.className = 'req-msg req-msg-err';
                }
            })
            .catch(function () { msg.textContent = 'Request failed.'; msg.className = 'req-msg req-msg-err'; });
        });
    }

    // ── My own holiday requests ───────────────────────────────────────────────
    function loadMyRequests() {
        fetch('/holiday-requests/mine')
            .then(function (r) { return r.json(); })
            .then(function (reqs) { renderMyRequests(reqs); })
            .catch(function () {});
    }

    function renderMyRequests(reqs) {
        var tbody = document.getElementById('my-requests-body');
        if (!tbody) return;
        var visible = reqs.filter(function (r) { return r.status !== 'cancelled' && r.status !== 'removed'; });
        if (visible.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="mgr-table-empty">No holiday requests.</td></tr>';
            return;
        }
        visible.sort(function (a, b) { return b.requestedAt.localeCompare(a.requestedAt); });
        tbody.innerHTML = '';
        visible.forEach(function (req) {
            var tr = document.createElement('tr');
            var actionHTML = req.status === 'pending'
                ? '<button class="mgr-action-btn mgr-remove" data-id="' + req.id + '">Cancel</button>'
                : '';
            tr.innerHTML =
                '<td>' + fmtDay(req.startDate) + '</td>' +
                '<td>' + fmtDay(req.endDate)   + '</td>' +
                '<td>' + req.days              + '</td>' +
                '<td>' + statusBadge(req.status) + '</td>' +
                '<td class="leave-actions">' + actionHTML + '</td>';
            var cancelBtn = tr.querySelector('.mgr-remove');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', function () {
                    if (!confirm('Cancel this holiday request?')) return;
                    fetch('/holiday-requests/mine/' + req.id, { method: 'DELETE' })
                        .then(function (r) { return r.json(); })
                        .then(function (data) {
                            if (data.success) { loadMyRequests(); if (window.HolidayMatrix) window.HolidayMatrix.reload(); }
                            else alert(data.error || 'Could not cancel.');
                        })
                        .catch(function () {});
                });
            }
            tbody.appendChild(tr);
        });
    }

    // ── Absences ─────────────────────────────────────────────────────────────
    function loadAbsences() {
        fetch('/absences/team')
            .then(function (r) { return r.json(); })
            .then(function (absences) { renderAbsences(absences); })
            .catch(function () {});
    }

    function renderAbsences(absences) {
        var tbody = document.getElementById('absences-body');
        if (!tbody) return;
        absences.sort(function (a, b) { return b.startDate.localeCompare(a.startDate); });
        if (absences.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="mgr-table-empty">No absence records.</td></tr>';
            return;
        }
        tbody.innerHTML = '';
        absences.forEach(function (a) {
            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td>' + a.username + '</td>' +
                '<td>' + fmtDay(a.startDate) + '</td>' +
                '<td>' + fmtDay(a.endDate) + '</td>' +
                '<td style="color:var(--mid);font-size:0.82rem;">' + (a.reason || '—') + '</td>' +
                '<td class="leave-actions">' +
                    '<button class="mgr-action-btn mgr-remove" data-id="' + a.id + '">Remove</button>' +
                '</td>';
            tr.querySelector('.mgr-remove').addEventListener('click', function () {
                if (!confirm('Remove this absence record?')) return;
                fetch('/absences/' + a.id, { method: 'DELETE' })
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        if (data.success) { loadAbsences(); if (window.HolidayMatrix) window.HolidayMatrix.reload(); }
                    })
                    .catch(function () {});
            });
            tbody.appendChild(tr);
        });
    }

    var absenceSubmit = document.getElementById('absence-submit');
    if (absenceSubmit) {
        absenceSubmit.addEventListener('click', function () {
            var forSel  = document.getElementById('absence-for');
            var start   = document.getElementById('absence-start').value;
            var end     = document.getElementById('absence-end').value;
            var reason  = document.getElementById('absence-reason').value.trim();
            var msg     = document.getElementById('absence-msg');

            if (!forSel || !forSel.value) { msg.textContent = 'Please select an employee.'; msg.className = 'req-msg req-msg-err'; return; }
            if (!start || !end)           { msg.textContent = 'Please select both dates.';  msg.className = 'req-msg req-msg-err'; return; }
            if (end < start)              { msg.textContent = 'End date must be on or after start date.'; msg.className = 'req-msg req-msg-err'; return; }

            msg.textContent = 'Saving…';
            msg.className = 'req-msg';

            fetch('/absences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: forSel.value, startDate: start, endDate: end, reason: reason }),
            })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.id) {
                    msg.textContent = 'Absence logged.';
                    msg.className = 'req-msg req-msg-ok';
                    document.getElementById('absence-start').value  = '';
                    document.getElementById('absence-end').value    = '';
                    document.getElementById('absence-reason').value = '';
                    loadAbsences();
                    if (window.HolidayMatrix) window.HolidayMatrix.reload();
                } else {
                    msg.textContent = data.error || 'Failed to log absence.';
                    msg.className = 'req-msg req-msg-err';
                }
            })
            .catch(function () { msg.textContent = 'Request failed.'; msg.className = 'req-msg req-msg-err'; });
        });
    }

    function populateAbsenceFor(users) {
        var sel = document.getElementById('absence-for');
        if (!sel) return;
        sel.innerHTML = '';
        users.forEach(function (u) {
            var opt = document.createElement('option');
            opt.value = u.username;
            opt.textContent = u.username;
            sel.appendChild(opt);
        });
    }

    // ── Leave request status filter ───────────────────────────────────────────
    (function () {
        var sel = document.getElementById('lr-status-filter');
        if (sel) sel.addEventListener('change', applyRequestFilter);
    })();

    // ── Team department filter ────────────────────────────────────────────────
    (function () {
        var sel = document.getElementById('team-dept-filter');
        if (sel) sel.addEventListener('change', applyTeamFilter);
    })();

    // ── Drawer toggles ────────────────────────────────────────────────────────
    (function () {
        var holidayBtn    = document.getElementById('holiday-drawer-toggle');
        var holidayDrawer = document.getElementById('holiday-drawer');
        if (holidayBtn && holidayDrawer) {
            holidayBtn.addEventListener('click', function () {
                var open = holidayDrawer.classList.toggle('open');
                holidayBtn.querySelector('.dash-qa-icon').textContent = open ? '−' : '+';
            });
        }

        var absenceBtn    = document.getElementById('absence-drawer-toggle');
        var absenceDrawer = document.getElementById('absence-drawer');
        if (absenceBtn && absenceDrawer) {
            absenceBtn.addEventListener('click', function () {
                var open = absenceDrawer.classList.toggle('open');
                absenceBtn.querySelector('.dash-qa-icon').textContent = open ? '−' : '+';
            });
        }
    })();

    loadTeam();
    loadRequests();
    loadMyRequests();
    loadAbsences();
    if (window.HolidayMatrix) window.HolidayMatrix.reload();

    // Populate dropdowns after team loads
    fetch('/users')
        .then(function (r) { return r.json(); })
        .then(function (users) { populateBookFor(users); populateAbsenceFor(users); })
        .catch(function () {});

})();
