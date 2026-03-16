// handle displaying error/success messages on the login page
(function() {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    const msg = params.get('message');
    if (err) {
        const el = document.getElementById('error');
        if (el) el.textContent = decodeURIComponent(err);
    }
    if (msg) {
        const el = document.getElementById('message');
        if (el) el.textContent = decodeURIComponent(msg);
    }
})();
