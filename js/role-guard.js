/**
 * role-guard.js — Role guard stub for Photarea (GitHub Pages static version).
 * On a static site there is no backend role verification, so this file is a no-op.
 */
(function () {
  // No backend available — skip role checks.
  window.roleGuard = {
    require: function () { /* no-op */ },
    check: function () { return true; }
  };
})();
