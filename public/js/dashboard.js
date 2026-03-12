// ── Holiday count ─────────────────────────────────────────────────────────────
(function () {
    const daysLeftEl = document.getElementById('days-left');
    if (!daysLeftEl) return;
    fetch('/session')
        .then(r => r.json())
        .then(user => {
            const heading = document.getElementById('dash-main-heading');
            if (heading && user.username) heading.textContent = 'Dashboard – ' + user.username;

            const total = (user.totalHolidays ?? 28) + (user.carriedOver ?? 0);
            const taken = user.takenHolidays ?? 0;
            daysLeftEl.textContent = total - taken;

            const detailEl = document.getElementById('this-year-detail');
            if (detailEl) detailEl.textContent = taken + ' taken of ' + total;

            const nextBookedEl = document.getElementById('next-year-booked');
            const nextDetailEl = document.getElementById('next-year-detail');
            if (nextBookedEl) nextBookedEl.textContent = user.nextYearTaken ?? 0;
            if (nextDetailEl) {
                const nextAllow = user.nextYearHolidays ?? user.totalHolidays ?? 28;
                nextDetailEl.textContent = 'of ' + nextAllow + ' allowance';
            }
        })
        .catch(() => { daysLeftEl.textContent = '—'; });
})();

// ── Year Calendar ─────────────────────────────────────────────────────────────
// ── UK Bank Holiday Calculator (England & Wales) ──────────────────────────────
function easterSunday(year) {
    var a = year % 19, b = Math.floor(year / 100), c = year % 100;
    var d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4), k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var month = Math.floor((h + l - 7 * m + 114) / 31);
    var day   = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}

function firstMonday(year, month) {
    var d = new Date(year, month, 1);
    while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
    return d;
}

function lastMonday(year, month) {
    var d = new Date(year, month + 1, 0); // last day of month
    while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
    return d;
}

function substituteMonday(date) {
    // If date falls on Sat, move to Mon; if Sun, move to Mon
    var d = new Date(date);
    if (d.getDay() === 6) d.setDate(d.getDate() + 2);
    else if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    return d;
}

function getBankHolidays(year) {
    var dates = [];
    var fmt = function (d) { return d.toISOString().slice(0, 10); };

    // New Year's Day
    dates.push(fmt(substituteMonday(new Date(year, 0, 1))));

    // Good Friday & Easter Monday
    var easter = easterSunday(year);
    var gf = new Date(easter); gf.setDate(gf.getDate() - 2);
    var em = new Date(easter); em.setDate(em.getDate() + 1);
    dates.push(fmt(gf), fmt(em));

    // Early May bank holiday (first Monday in May)
    dates.push(fmt(firstMonday(year, 4)));

    // Spring bank holiday (last Monday in May)
    dates.push(fmt(lastMonday(year, 4)));

    // Summer bank holiday (last Monday in August)
    dates.push(fmt(lastMonday(year, 7)));

    // Christmas & Boxing Day (with substitution)
    var xmas  = substituteMonday(new Date(year, 11, 25));
    var boxing = new Date(xmas); boxing.setDate(boxing.getDate() + 1);
    if (boxing.getDay() === 6) boxing.setDate(boxing.getDate() + 2);
    else if (boxing.getDay() === 0) boxing.setDate(boxing.getDate() + 1);
    dates.push(fmt(xmas), fmt(boxing));

    return new Set(dates);
}

window.YearCalendar = (function () {
    const container = document.getElementById('year-calendar');
    const yearLabel  = document.getElementById('cal-year-label');
    if (!container) return null;

    const today = new Date();
    let displayYear = today.getFullYear();
    let highlights  = {}; // { 'YYYY-MM-DD': ['#colour', ...] }
    let calWorkDays = null; // null = treat Sat/Sun as non-working (default)

    const MONTH_NAMES = ['January','February','March','April','May','June',
                         'July','August','September','October','November','December'];
    const DAY_ABBR    = ['Mo','Tu','We','Th','Fr','Sa','Su'];

    function toKey(y, m, d) {
        return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    }

    function renderCalendar(year) {
        if (yearLabel) yearLabel.textContent = year + ' — Full Year Calendar';
        container.innerHTML = '';
        var bankHols = getBankHolidays(year);

        for (let m = 0; m < 12; m++) {
            const monthEl = document.createElement('div');
            monthEl.className = 'cal-month';

            const nameEl = document.createElement('div');
            nameEl.className = 'cal-month-name';
            nameEl.textContent = MONTH_NAMES[m];
            monthEl.appendChild(nameEl);

            const headerEl = document.createElement('div');
            headerEl.className = 'cal-days-header';
            DAY_ABBR.forEach(d => {
                const s = document.createElement('span');
                s.textContent = d;
                headerEl.appendChild(s);
            });
            monthEl.appendChild(headerEl);

            const gridEl = document.createElement('div');
            gridEl.className = 'cal-days-grid';

            const offset      = (new Date(year, m, 1).getDay() + 6) % 7;
            const daysInMonth = new Date(year, m + 1, 0).getDate();

            for (let i = 0; i < offset; i++) {
                const empty = document.createElement('div');
                empty.className = 'cal-day empty';
                empty.textContent = '.';
                gridEl.appendChild(empty);
            }

            for (let d = 1; d <= daysInMonth; d++) {
                const dow          = new Date(year, m, d).getDay();
                const isNonWork    = calWorkDays ? calWorkDays.indexOf(dow) === -1 : (dow === 0 || dow === 6);
                const isToday      = d === today.getDate() && m === today.getMonth() && year === today.getFullYear();
                const isBankHol    = bankHols.has(toKey(year, m, d));

                const dayEl = document.createElement('div');
                dayEl.className = 'cal-day' +
                    (isNonWork  ? ' weekend'      : '') +
                    (isBankHol  ? ' bank-holiday' : '') +
                    (isToday    ? ' today'         : '');

                const numEl = document.createElement('span');
                numEl.className = 'cal-day-num';
                numEl.textContent = d;
                dayEl.appendChild(numEl);

                const colours = highlights[toKey(year, m, d)];
                if (colours && colours.length && !isNonWork) {
                    const dots = document.createElement('div');
                    dots.className = 'cal-day-dots';
                    colours.slice(0, 4).forEach(c => {
                        const dot = document.createElement('span');
                        dot.style.background = c;
                        dots.appendChild(dot);
                    });
                    dayEl.appendChild(dots);
                }

                gridEl.appendChild(dayEl);
            }

            monthEl.appendChild(gridEl);
            container.appendChild(monthEl);
        }
    }

    renderCalendar(displayYear);

    document.getElementById('cal-prev-year').addEventListener('click', () => {
        displayYear--;
        renderCalendar(displayYear);
    });
    document.getElementById('cal-next-year').addEventListener('click', () => {
        displayYear++;
        renderCalendar(displayYear);
    });

    return {
        setHighlights: function (h) {
            highlights = h || {};
            renderCalendar(displayYear);
        },
        setWorkDays: function (wd) {
            calWorkDays = (wd && wd.length > 0) ? wd : null;
            renderCalendar(displayYear);
        }
    };
})();

// ── Month Calendar ────────────────────────────────────────────────────────────
window.MonthCalendar = (function () {
    var container = document.getElementById('month-calendar');
    var labelEl   = document.getElementById('cal-month-label');
    if (!container) return null;

    var today        = new Date();
    var displayYear  = today.getFullYear();
    var displayMonth = today.getMonth();
    var highlights   = {}; // { 'YYYY-MM-DD': [{colour, status}] }

    var MONTH_NAMES = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];
    var DAY_NAMES   = ['Mo','Tu','We','Th','Fr','Sa','Su'];

    function toKey(y, m, d) {
        return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    }

    function render() {
        if (labelEl) labelEl.textContent = MONTH_NAMES[displayMonth] + ' ' + displayYear;
        container.innerHTML = '';
        var bankHols = getBankHolidays(displayYear);

        var headerEl = document.createElement('div');
        headerEl.className = 'mcal-days-header';
        DAY_NAMES.forEach(function (n) {
            var s = document.createElement('span');
            s.textContent = n;
            headerEl.appendChild(s);
        });
        container.appendChild(headerEl);

        var gridEl = document.createElement('div');
        gridEl.className = 'mcal-grid';

        var offset      = (new Date(displayYear, displayMonth, 1).getDay() + 6) % 7;
        var daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();

        for (var i = 0; i < offset; i++) {
            var empty = document.createElement('div');
            empty.className = 'mcal-day mcal-empty';
            gridEl.appendChild(empty);
        }

        for (var d = 1; d <= daysInMonth; d++) {
            var dow       = new Date(displayYear, displayMonth, d).getDay();
            var isWeekend = dow === 0 || dow === 6;
            var isToday   = d === today.getDate() && displayMonth === today.getMonth() && displayYear === today.getFullYear();
            var isBankHol = bankHols.has(toKey(displayYear, displayMonth, d));
            var entries   = highlights[toKey(displayYear, displayMonth, d)] || [];

            var dayEl = document.createElement('div');
            dayEl.className = 'mcal-day' +
                (isWeekend ? ' mcal-weekend'      : '') +
                (isBankHol ? ' mcal-bank-holiday' : '') +
                (isToday   ? ' mcal-today'         : '');

            var numEl = document.createElement('span');
            numEl.className = 'mcal-day-num';
            numEl.textContent = d;
            dayEl.appendChild(numEl);

            if (entries.length > 0) {
                var dotsEl = document.createElement('div');
                dotsEl.className = 'mcal-dots';
                entries.slice(0, 6).forEach(function (e) {
                    var dot = document.createElement('span');
                    dot.className = 'mcal-dot' + (e.status === 'pending' ? ' mcal-dot-pending' : '');
                    dot.style.background = e.colour;
                    dotsEl.appendChild(dot);
                });
                dayEl.appendChild(dotsEl);
            }

            gridEl.appendChild(dayEl);
        }

        container.appendChild(gridEl);
    }

    render();

    document.getElementById('cal-month-prev').addEventListener('click', function () {
        if (--displayMonth < 0) { displayMonth = 11; displayYear--; }
        render();
    });
    document.getElementById('cal-month-next').addEventListener('click', function () {
        if (++displayMonth > 11) { displayMonth = 0; displayYear++; }
        render();
    });

    return {
        setHighlights: function (h) {
            highlights = h || {};
            render();
        }
    };
})();

// ── Employee: load own holidays onto calendars ────────────────────────────────
(function () {
    if (!document.getElementById('days-left')) return; // only on employee page

    Promise.all([
        fetch('/holiday-requests/mine').then(r => r.json()),
        fetch('/session').then(r => r.json()),
        fetch('/absences/mine').then(r => r.json()).catch(function () { return []; }),
    ]).then(function (results) {
        var reqs     = results[0];
        var user     = results[1];
        var absences = results[2];
        var colour   = user.colour || '#4A90D9';

        var yearH  = {}; // approved only
        var monthH = {}; // approved + pending

        reqs.forEach(function (req) {
            if (req.status !== 'approved' && req.status !== 'pending') return;
            var d   = new Date(req.startDate);
            var end = new Date(req.endDate);
            while (d <= end) {
                var key = d.toISOString().slice(0, 10);
                if (req.status === 'approved') {
                    yearH[key] = yearH[key] || [];
                    if (yearH[key].indexOf(colour) === -1) yearH[key].push(colour);
                }
                monthH[key] = monthH[key] || [];
                monthH[key].push({ colour: colour, status: req.status });
                d.setDate(d.getDate() + 1);
            }
        });

        // Mark absence days on the year calendar with a distinct red/amber colour
        var absentColour = '#c0392b';
        absences.forEach(function (a) {
            var d   = new Date(a.startDate);
            var end = new Date(a.endDate);
            while (d <= end) {
                var key = d.toISOString().slice(0, 10);
                yearH[key] = yearH[key] || [];
                if (yearH[key].indexOf(absentColour) === -1) yearH[key].push(absentColour);
                d.setDate(d.getDate() + 1);
            }
        });

        if (window.YearCalendar) {
            window.YearCalendar.setWorkDays(user.workDays || null);
            window.YearCalendar.setHighlights(yearH);
        }
        if (window.MonthCalendar) window.MonthCalendar.setHighlights(monthH);
    }).catch(function () {});
})();

// ── Employee: holiday request form & list ─────────────────────────────────────
(function () {
    var form     = document.getElementById('holiday-request-form');
    var listBody = document.getElementById('request-list-body');
    if (!form) return;

    function statusBadge(s) {
        var map = { pending: '#e8a020', approved: '#25764A', declined: '#c0392b' };
        var c   = map[s] || '#888';
        return '<span style="display:inline-block;padding:0.15rem 0.5rem;font-size:0.65rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;background:' + c + '22;color:' + c + '">' + s + '</span>';
    }

    function fmtDay(s) {
        if (!s) return '—';
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var p = s.split('-');
        return p[2] + ' ' + months[parseInt(p[1], 10) - 1] + ' ' + p[0];
    }

    function loadList() {
        fetch('/holiday-requests/mine')
            .then(function (r) { return r.json(); })
            .then(function (reqs) {
                if (!listBody) return;
                if (reqs.length === 0) {
                    listBody.innerHTML = '<tr><td colspan="5" class="req-empty">No requests yet.</td></tr>';
                    return;
                }
                reqs.sort(function (a, b) { return b.requestedAt.localeCompare(a.requestedAt); });
                listBody.innerHTML = '';
                reqs.forEach(function (r) {
                    var tr = document.createElement('tr');
                    tr.innerHTML =
                        '<td>' + fmtDay(r.startDate) + '</td>' +
                        '<td>' + fmtDay(r.endDate)   + '</td>' +
                        '<td>' + r.days      + '</td>' +
                        '<td>' + statusBadge(r.status) + '</td>' +
                        '<td>' + (r.status === 'pending' ? '<button class="req-cancel-btn" data-id="' + r.id + '">Cancel</button>' : '') + '</td>';
                    listBody.appendChild(tr);
                });

                listBody.querySelectorAll('.req-cancel-btn').forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        if (!confirm('Cancel this holiday request?')) return;
                        fetch('/holiday-requests/mine/' + btn.dataset.id, { method: 'DELETE' })
                            .then(function (r) { return r.json(); })
                            .then(function (data) {
                                if (data.success) loadList();
                                else alert(data.error || 'Could not cancel request.');
                            })
                            .catch(function () {});
                    });
                });
            })
            .catch(function () {});
    }

    loadList();

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var msg       = document.getElementById('request-msg');
        var startDate = form.startDate.value;
        var endDate   = form.endDate.value;
        msg.textContent = '';
        msg.className   = 'req-msg';

        fetch('/holiday-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate: startDate, endDate: endDate }),
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.success) {
                msg.textContent = 'Request submitted.';
                msg.className   = 'req-msg req-msg-ok';
                form.reset();
                loadList();
                if (window.HolidayMatrix) window.HolidayMatrix.reload();
            } else {
                msg.textContent = data.error || 'Failed to submit.';
                msg.className   = 'req-msg req-msg-err';
            }
        })
        .catch(function () {
            msg.textContent = 'Request failed.';
            msg.className   = 'req-msg req-msg-err';
        });
    });
})();

// ── Quick Links dropdown ───────────────────────────────────────────────────────
(function () {
    var wrap = document.getElementById('links-dropdown-wrap');
    var btn  = document.getElementById('links-btn');
    if (!wrap || !btn) return;

    btn.addEventListener('click', function (e) {
        e.stopPropagation();
        wrap.classList.toggle('open');
    });

    document.addEventListener('click', function () {
        wrap.classList.remove('open');
    });

    wrap.querySelector('.dash-links-menu').addEventListener('click', function (e) {
        e.stopPropagation();
    });
})();
