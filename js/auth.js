/**
 * auth.js — Auth stub for Photarea (GitHub Pages static version).
 * Since there is no backend on GitHub Pages, this file provides a no-op
 * implementation so pages load without errors.
 * Links with [data-protected] are left clickable (no redirect).
 */
(function () {
  // No backend available on GitHub Pages – auth features are disabled.
  window.authState = {
    loggedIn: false,
    user: null,
    token: null
  };

  // Guard: pages that require auth just load normally on static site
  document.addEventListener('DOMContentLoaded', function () {
    // Remove "data-protected" redirect behaviour — links are always accessible
    // (they just won't show private data without a backend)
    document.querySelectorAll('[data-protected]').forEach(function (el) {
      el.removeAttribute('data-protected');
    });
  });
})();
