(function () {
    var section = document.getElementById('holiday-matrix-section');
    if (!section) return;

    var today        = new Date();
    var displayYear  = today.getFullYear();
    var displayMonth = today.getMonth();

    var MONTH_NAMES = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];
    var DAY_ABBR    = ['Su','Mo','Tu','We','Th','Fr','Sa'];

    var allUsers    = [];
    var allRequests = [];
    var allAbsences = [];
    var departments = [];
    var filterDept  = '';

    function toKey(y, m, d) {
        return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    }

    function buildReqMap() {
        var map = {};
        allRequests.forEach(function (r) {
            if (!map[r.username]) map[r.username] = {};
            var d   = new Date(r.startDate);
            var end = new Date(r.endDate);
            while (d <= end) {
                var key = d.toISOString().slice(0, 10);
                if (!map[r.username][key] || r.status === 'approved') {
                    map[r.username][key] = r.status;
                }
                d.setDate(d.getDate() + 1);
            }
        });
        return map;
    }

    function buildAbsenceMap() {
        var map = {};
        allAbsences.forEach(function (a) {
            if (!map[a.username]) map[a.username] = {};
            var d   = new Date(a.startDate);
            var end = new Date(a.endDate);
            while (d <= end) {
                map[a.username][d.toISOString().slice(0, 10)] = true;
                d.setDate(d.getDate() + 1);
            }
        });
        return map;
    }

    function render() {
        var bankHols    = typeof getBankHolidays === 'function' ? getBankHolidays(displayYear) : new Set();
        var daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
        var reqMap      = buildReqMap();
        var absenceMap  = buildAbsenceMap();
        var visible     = (filterDept
            ? allUsers.filter(function (u) { return u.department === filterDept; })
            : allUsers.slice()
        ).sort(function (a, b) {
            var dA = (a.department || '').toLowerCase();
            var dB = (b.department || '').toLowerCase();
            if (dA < dB) return -1;
            if (dA > dB) return  1;
            return (a.username || '').toLowerCase().localeCompare((b.username || '').toLowerCase());
        });

        section.innerHTML = '';

        // ── Controls ─────────────────────────────────────────────────────────
        var controls = document.createElement('div');
        controls.className = 'hm-controls';

        var titleEl = document.createElement('span');
        titleEl.className = 'hm-title';
        titleEl.textContent = 'Team Holiday Matrix';

        var prevBtn = document.createElement('button');
        prevBtn.className = 'hm-nav-btn';
        prevBtn.innerHTML = '&#8592;';

        var monthLabel = document.createElement('span');
        monthLabel.className = 'hm-month-label';
        monthLabel.textContent = MONTH_NAMES[displayMonth] + ' ' + displayYear;

        var nextBtn = document.createElement('button');
        nextBtn.className = 'hm-nav-btn';
        nextBtn.innerHTML = '&#8594;';

        var monthNav = document.createElement('div');
        monthNav.className = 'hm-month-nav';
        monthNav.appendChild(prevBtn);
        monthNav.appendChild(monthLabel);
        monthNav.appendChild(nextBtn);

        var filterLabel = document.createElement('label');
        filterLabel.className = 'hm-filter-label';
        filterLabel.setAttribute('for', 'hm-dept');
        filterLabel.textContent = 'Department';

        var deptSel = document.createElement('select');
        deptSel.className = 'hm-dept-select';
        deptSel.id = 'hm-dept';
        var allOpt = document.createElement('option');
        allOpt.value = '';
        allOpt.textContent = 'All';
        deptSel.appendChild(allOpt);
        departments.forEach(function (d) {
            var opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            if (d === filterDept) opt.selected = true;
            deptSel.appendChild(opt);
        });

        var filterDiv = document.createElement('div');
        filterDiv.className = 'hm-filter';
        filterDiv.appendChild(filterLabel);
        filterDiv.appendChild(deptSel);

        var legend = document.createElement('div');
        legend.className = 'hm-legend';
        legend.innerHTML =
            '<span class="hm-legend-item"><span class="hm-legend-swatch hm-ls-approved"></span>Approved</span>' +
            '<span class="hm-legend-item"><span class="hm-legend-swatch hm-ls-pending"></span>Pending</span>' +
            '<span class="hm-legend-item"><span class="hm-legend-swatch hm-ls-absent"></span>Absent</span>';

        controls.appendChild(titleEl);
        controls.appendChild(monthNav);
        controls.appendChild(filterDiv);
        controls.appendChild(legend);
        section.appendChild(controls);

        // ── Table ─────────────────────────────────────────────────────────────
        var scrollWrap = document.createElement('div');
        scrollWrap.className = 'hm-scroll';

        var table = document.createElement('table');
        table.className = 'hm-table';

        // thead
        var thead = document.createElement('thead');
        var hdrRow = document.createElement('tr');
        var cornerTh = document.createElement('th');
        cornerTh.className = 'hm-th-name';
        hdrRow.appendChild(cornerTh);

        for (var day = 1; day <= daysInMonth; day++) {
            var dow     = new Date(displayYear, displayMonth, day).getDay();
            var isWknd  = dow === 0 || dow === 6;
            var isBkHol = bankHols.has(toKey(displayYear, displayMonth, day));
            var isTdy   = day === today.getDate() && displayMonth === today.getMonth() && displayYear === today.getFullYear();

            var th = document.createElement('th');
            th.className = 'hm-th-day' +
                (isWknd  ? ' hm-wknd'    : '') +
                (isBkHol ? ' hm-bkhol'   : '') +
                (isTdy   ? ' hm-col-tdy' : '');

            var dnEl = document.createElement('span');
            dnEl.className = 'hm-dnum';
            dnEl.textContent = day;

            var ddEl = document.createElement('span');
            ddEl.className = 'hm-ddow';
            ddEl.textContent = DAY_ABBR[dow];

            th.appendChild(dnEl);
            th.appendChild(ddEl);
            hdrRow.appendChild(th);
        }
        thead.appendChild(hdrRow);
        table.appendChild(thead);

        // tbody
        var tbody = document.createElement('tbody');
        if (visible.length === 0) {
            var emptyTr = document.createElement('tr');
            var emptyTd = document.createElement('td');
            emptyTd.colSpan = daysInMonth + 1;
            emptyTd.className = 'hm-empty-cell';
            emptyTd.textContent = 'No users in this category.';
            emptyTr.appendChild(emptyTd);
            tbody.appendChild(emptyTr);
        } else {
            visible.forEach(function (u) {
                var uMap = reqMap[u.username] || {};
                var tr   = document.createElement('tr');

                var tdName = document.createElement('td');
                tdName.className = 'hm-td-name';
                tdName.title = u.department ? u.username + ' — ' + u.department : u.username;

                var dot = document.createElement('span');
                dot.className = 'hm-dot';
                dot.style.background = u.colour;

                var nameSpan = document.createElement('span');
                nameSpan.className = 'hm-uname';
                nameSpan.textContent = u.username;

                tdName.appendChild(dot);
                tdName.appendChild(nameSpan);

                if (u.department) {
                    var dTag = document.createElement('span');
                    dTag.className = 'hm-dept-tag';
                    dTag.textContent = u.department;
                    tdName.appendChild(dTag);
                }

                tr.appendChild(tdName);

                var uAbsMap = absenceMap[u.username] || {};
                for (var d = 1; d <= daysInMonth; d++) {
                    var dow2    = new Date(displayYear, displayMonth, d).getDay();
                    var isWknd2 = dow2 === 0 || dow2 === 6;
                    var isBk2   = bankHols.has(toKey(displayYear, displayMonth, d));
                    var isTdy2  = d === today.getDate() && displayMonth === today.getMonth() && displayYear === today.getFullYear();
                    var dKey    = toKey(displayYear, displayMonth, d);
                    var status  = uMap[dKey];
                    var isAbsent = !!uAbsMap[dKey];

                    var isNonWork2 = u.workDays ? u.workDays.indexOf(dow2) === -1 : (dow2 === 0 || dow2 === 6);
                    var td = document.createElement('td');
                    td.className = 'hm-td-day' +
                        (isNonWork2                              ? ' hm-non-working' : '') +
                        (isBk2 && !isNonWork2                    ? ' hm-bkhol'       : '') +
                        (isTdy2                                  ? ' hm-col-tdy'     : '') +
                        (!isNonWork2 && status === 'pending'     ? ' hm-pending'     : '') +
                        (!isNonWork2 && isAbsent && !status      ? ' hm-absent'      : '');

                    if (!isNonWork2 && status) {
                        td.style.background = u.colour;
                    }

                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            });
        }

        table.appendChild(tbody);
        scrollWrap.appendChild(table);
        section.appendChild(scrollWrap);

        // ── Events ────────────────────────────────────────────────────────────
        prevBtn.addEventListener('click', function () {
            if (--displayMonth < 0) { displayMonth = 11; displayYear--; }
            render();
        });
        nextBtn.addEventListener('click', function () {
            if (++displayMonth > 11) { displayMonth = 0; displayYear++; }
            render();
        });
        deptSel.addEventListener('change', function () {
            filterDept = this.value;
            render();
        });
    }

    function load() {
        fetch('/holiday-matrix')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                allUsers    = (data.users    || []).filter(function (u) { return !!u.username; });
                allRequests =  data.requests || [];
                allAbsences =  data.absences || [];
                var deptSet = {};
                allUsers.forEach(function (u) { if (u.department) deptSet[u.department] = true; });
                departments = Object.keys(deptSet).sort();
                render();
            })
            .catch(function () {
                section.innerHTML = '<p class="hm-empty-cell" style="padding:2rem;text-align:center;">Could not load holiday data.</p>';
            });
    }

    load();
    window.HolidayMatrix = { reload: load };
})();
