(function () {
    const panel = document.getElementById('news-panel');
    const tab   = document.getElementById('news-tab');
    const list  = document.getElementById('news-list');
    if (!panel || !tab || !list) return;

    // Notification badge
    const badge = document.createElement('span');
    badge.className = 'news-badge';
    badge.style.display = 'none';
    tab.appendChild(badge);

    tab.addEventListener('click', () => {
        panel.classList.toggle('open');
        if (panel.classList.contains('open')) {
            localStorage.setItem('newsLastSeenAt', new Date().toISOString());
            badge.style.display = 'none';
        }
    });

    function esc(s) {
        return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function fmt(iso) {
        if (!iso) return '';
        return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function isNetworkPath(url) {
        return url.startsWith('\\\\') || url.startsWith('//');
    }

    function renderLink(l) {
        const url   = (l.url   || '').trim();
        const label = (l.label || url).trim();
        if (!url) return '';
        if (isNetworkPath(url)) {
            // Browsers block UNC paths — show a copy-to-clipboard button instead
            return `<button class="news-link news-link-copy" data-path="${esc(url)}">&#128194; ${esc(label)} <span class="news-link-copy-hint">(click to copy path)</span></button>`;
        }
        return `<a href="${esc(url)}" target="_blank" rel="noreferrer noopener" class="news-link">&#128279; ${esc(label)}</a>`;
    }

    function bindCopyButtons() {
        list.querySelectorAll('.news-link-copy').forEach(btn => {
            btn.addEventListener('click', () => {
                const path = btn.dataset.path;
                navigator.clipboard.writeText(path).then(() => {
                    const orig = btn.innerHTML;
                    btn.innerHTML = '&#10003; Copied!';
                    btn.style.color = 'var(--green)';
                    setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 2000);
                }).catch(() => {
                    prompt('Copy this path:', path);
                });
            });
        });
    }

    function render(posts) {
        if (!posts.length) {
            list.innerHTML = '<p class="news-empty">No announcements yet.</p>';
            return;
        }
        list.innerHTML = posts.map(p => {
            const links = (p.links || []).map(renderLink).join('');
            const pin = p.pinned ? '<span class="news-pin">&#128204;</span> ' : '';
            return `<div class="news-post">
                <div class="news-post-title">${pin}${esc(p.title)}<span class="news-post-chevron">&#9656;</span></div>
                <div class="news-post-meta">${fmt(p.createdAt)} &bull; ${esc(p.createdBy)}</div>
                ${p.body ? `<div class="news-post-body">${esc(p.body)}</div>` : ''}
                ${links ? `<div class="news-post-links">${links}</div>` : ''}
            </div>`;
        }).join('');
        list.querySelectorAll('.news-post').forEach(post => {
            post.querySelector('.news-post-title').addEventListener('click', () => {
                post.classList.toggle('open');
            });
        });
        bindCopyButtons();
    }

    fetch('/api/news')
        .then(r => r.json())
        .then(posts => {
            render(posts);
            const lastSeen = localStorage.getItem('newsLastSeenAt') || '0';
            const newCount = posts.filter(p => p.createdAt && p.createdAt > lastSeen).length;
            if (newCount > 0) {
                badge.textContent = newCount > 9 ? '9+' : String(newCount);
                badge.style.display = 'flex';
            }
        })
        .catch(() => { list.innerHTML = '<p class="news-empty">Could not load news.</p>'; });
})();
