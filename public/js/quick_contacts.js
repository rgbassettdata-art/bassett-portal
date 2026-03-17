(function () {
    var panel = document.getElementById('quick-contacts-panel');
    if (!panel) return;

    var phoneData    = { sections: [] };
    var username     = '';
    var isCustomising = false;

    /* ── LocalStorage helpers ─────────────────────────────────────────── */
    function storageKey() { return 'qc-pins-' + username; }

    function loadPins() {
        try { return JSON.parse(localStorage.getItem(storageKey()) || '[]'); } catch (_) { return []; }
    }

    function savePins(ids) {
        localStorage.setItem(storageKey(), JSON.stringify(ids));
    }

    /* ── Flat list of all entries ──────────────────────────────────────── */
    function allEntries() {
        var out = [];
        phoneData.sections.forEach(function (s) {
            (s.entries || []).forEach(function (e) {
                out.push({ section: s.title, entry: e });
            });
        });
        return out;
    }

    function findEntry(id) {
        var all = allEntries();
        for (var i = 0; i < all.length; i++) {
            if (all[i].entry.id === id) return all[i];
        }
        return null;
    }

    /* ── Helpers ───────────────────────────────────────────────────────── */
    function getInitials(name) {
        if (!name) return '?';
        var parts = name.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        return name.trim()[0].toUpperCase();
    }

    function esc(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function stripSpace(s) { return (s || '').replace(/\s/g, ''); }

    /* ── Main render ───────────────────────────────────────────────────── */
    function render() {
        var pins = loadPins();
        panel.innerHTML = '';

        var header = document.createElement('div');
        header.className = 'qc-header';

        var titleEl = document.createElement('span');
        titleEl.className = 'qc-title';
        titleEl.textContent = 'Quick Contacts';

        var custBtn = document.createElement('button');
        custBtn.className = 'qc-customise-btn';
        custBtn.innerHTML = isCustomising ? '&#10005; Done' : '&#9998; Customise';
        custBtn.addEventListener('click', function () {
            isCustomising = !isCustomising;
            render();
        });

        header.appendChild(titleEl);
        header.appendChild(custBtn);
        panel.appendChild(header);

        if (isCustomising) {
            renderCustomise(pins);
        } else {
            renderPinned(pins);
        }
    }

    /* ── Pinned contacts view ──────────────────────────────────────────── */
    function renderPinned(pins) {
        var body = document.createElement('div');
        body.className = 'qc-body';

        if (pins.length === 0) {
            body.innerHTML =
                '<div class="qc-empty">' +
                    '<span class="qc-empty-icon">&#9742;</span>' +
                    '<p>No contacts pinned yet.<br>Click <strong>Customise</strong> to choose who appears here.</p>' +
                '</div>';
            panel.appendChild(body);
            return;
        }

        var hasAny = false;
        pins.forEach(function (id) {
            var found = findEntry(id);
            if (!found) return;
            body.appendChild(buildCard(found.entry, found.section));
            hasAny = true;
        });

        if (!hasAny) {
            body.innerHTML =
                '<div class="qc-empty">' +
                    '<span class="qc-empty-icon">&#9742;</span>' +
                    '<p>Pinned contacts could not be found.<br>Click <strong>Customise</strong> to update your selection.</p>' +
                '</div>';
        }

        panel.appendChild(body);
    }

    /* ── Build a single contact card ───────────────────────────────────── */
    function buildCard(entry, sectionName) {
        var card = document.createElement('div');
        card.className = 'qc-card';

        /* Top row: avatar + info */
        var top = document.createElement('div');
        top.className = 'qc-card-top';

        var av = document.createElement('div');
        av.className = 'qc-avatar';
        av.textContent = getInitials(entry.name);

        var info = document.createElement('div');
        info.className = 'qc-card-info';

        var nameEl = document.createElement('div');
        nameEl.className = 'qc-card-name';
        nameEl.textContent = entry.name || '';
        info.appendChild(nameEl);

        if (entry.position) {
            var posEl = document.createElement('div');
            posEl.className = 'qc-card-pos';
            posEl.textContent = entry.position;
            info.appendChild(posEl);
        }

        if (sectionName) {
            var secEl = document.createElement('div');
            secEl.className = 'qc-card-section';
            secEl.textContent = sectionName;
            info.appendChild(secEl);
        }

        top.appendChild(av);
        top.appendChild(info);
        card.appendChild(top);

        /* Action buttons */
        var actions = document.createElement('div');
        actions.className = 'qc-card-actions';

        if (entry.internal) {
            var intBtn = document.createElement('span');
            intBtn.className = 'qc-action-btn qc-action-btn--internal';
            intBtn.title = 'Internal extension: ' + entry.internal;
            intBtn.innerHTML = '&#9743; Int. ' + esc(entry.internal);
            intBtn.addEventListener('click', function () {
                navigator.clipboard && navigator.clipboard.writeText(entry.internal);
                var orig = intBtn.innerHTML;
                intBtn.innerHTML = '&#10003; Copied';
                setTimeout(function () { intBtn.innerHTML = orig; }, 1500);
            });
            intBtn.style.cursor = 'pointer';
            actions.appendChild(intBtn);
        }

        if (entry.direct) {
            var dirA = document.createElement('a');
            dirA.className = 'qc-action-btn qc-action-btn--phone';
            dirA.href = 'tel:' + stripSpace(entry.direct);
            dirA.title = entry.direct;
            dirA.innerHTML = '&#128222; Direct';
            actions.appendChild(dirA);
        }

        if (entry.mobile) {
            var mobA = document.createElement('a');
            mobA.className = 'qc-action-btn qc-action-btn--mobile';
            mobA.href = 'tel:' + stripSpace(entry.mobile);
            mobA.title = entry.mobile;
            mobA.innerHTML = '&#128241; Mobile';
            actions.appendChild(mobA);
        }

        if (entry.email) {
            var emailA = document.createElement('a');
            emailA.className = 'qc-action-btn qc-action-btn--email';
            emailA.href = 'mailto:' + entry.email;
            emailA.title = entry.email;
            emailA.innerHTML = '&#9993; Email';
            actions.appendChild(emailA);
        }

        if (actions.children.length > 0) {
            card.appendChild(actions);
        }

        return card;
    }

    /* ── Customise view ─────────────────────────────────────────────────── */
    function renderCustomise(pins) {
        var pinSet = new Set(pins);

        var body = document.createElement('div');
        body.className = 'qc-body qc-customise-body';

        var hint = document.createElement('p');
        hint.className = 'qc-customise-hint';
        hint.textContent = 'Tick contacts to pin them to your dashboard.';
        body.appendChild(hint);

        var hasAnySections = false;

        phoneData.sections.forEach(function (section) {
            if (!section.entries || section.entries.length === 0) return;
            hasAnySections = true;

            var group = document.createElement('div');
            group.className = 'qc-section-group';

            var sLabel = document.createElement('div');
            sLabel.className = 'qc-section-label';
            sLabel.textContent = section.title;
            group.appendChild(sLabel);

            section.entries.forEach(function (entry) {
                var row = document.createElement('label');
                row.className = 'qc-pick-row' + (pinSet.has(entry.id) ? ' qc-pick-row--checked' : '');

                var cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.className = 'qc-pick-check';
                cb.checked = pinSet.has(entry.id);

                cb.addEventListener('change', function () {
                    var current = loadPins();
                    if (cb.checked) {
                        if (current.indexOf(entry.id) === -1) current.push(entry.id);
                        row.classList.add('qc-pick-row--checked');
                    } else {
                        current = current.filter(function (p) { return p !== entry.id; });
                        row.classList.remove('qc-pick-row--checked');
                    }
                    savePins(current);
                    pinSet = new Set(current);
                });

                var initials = document.createElement('span');
                initials.className = 'qc-initials';
                initials.textContent = getInitials(entry.name);

                var info = document.createElement('div');
                info.className = 'qc-pick-info';

                var nameSpan = document.createElement('span');
                nameSpan.className = 'qc-pick-name';
                nameSpan.textContent = entry.name || '';
                info.appendChild(nameSpan);

                if (entry.position) {
                    var posSpan = document.createElement('span');
                    posSpan.className = 'qc-pick-pos';
                    posSpan.textContent = entry.position;
                    info.appendChild(posSpan);
                }

                row.appendChild(cb);
                row.appendChild(initials);
                row.appendChild(info);
                group.appendChild(row);
            });

            body.appendChild(group);
        });

        if (!hasAnySections) {
            body.innerHTML = '<div class="qc-no-entries">No contacts in the phone list yet.</div>';
        }

        panel.appendChild(body);
    }

    /* ── Init ───────────────────────────────────────────────────────────── */
    fetch('/session')
        .then(function (r) { return r.json(); })
        .then(function (user) {
            username = user.username || '';
            return fetch('/api/phone-list');
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            phoneData = data || { sections: [] };
            render();
        })
        .catch(function () {
            panel.innerHTML =
                '<div class="qc-header"><span class="qc-title">Quick Contacts</span></div>' +
                '<div class="qc-body"><div class="qc-no-entries">Could not load contacts.</div></div>';
        });
})();
