// handle displaying error messages if login fails

// look for error query parameter and show message
(function() {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) {
        const el = document.getElementById('error');
        el.textContent = decodeURIComponent(err);
    }
})();
