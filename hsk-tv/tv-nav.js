// Home Survival Kit TV remote control: arrow keys move between buttons, OK presses,
// Back goes back. Works on every screen without changing the app's screens.
(function () {
  var SELECTOR = '[tabindex]:not([tabindex="-1"]), button, a[href], input, textarea, select, [role="button"], [role="link"], [role="switch"], [role="checkbox"], [role="tab"]';
  var current = null;

  // On top and on screen. Screens lower in the navigation stack stay in the page
  // behind the current one without being marked hidden, so hit-test instead.
  function visible(el) {
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
    var r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    var s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || el.offsetParent === null) return false;
    var left = Math.max(r.left, 0), right = Math.min(r.right, innerWidth);
    var top = Math.max(r.top, 0), bottom = Math.min(r.bottom, innerHeight);
    if (right - left < 4 || bottom - top < 4) return false;
    var points = [[(left + right) / 2, (top + bottom) / 2], [left + 3, top + 3], [right - 3, bottom - 3]];
    return points.some(function (p) {
      var hit = document.elementFromPoint(p[0], p[1]);
      return hit && (hit === el || el.contains(hit));
    });
  }
  function scrolls(p) {
    var s = getComputedStyle(p);
    return /(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 4;
  }
  function scrollerOf(el) {
    for (var p = el && el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (scrolls(p)) return p;
    }
    // e.g. the selection is in the header: scroll the biggest list on screen
    var best = null, area = 0;
    Array.prototype.forEach.call(document.querySelectorAll('div'), function (d) {
      if (!scrolls(d)) return;
      var r = d.getBoundingClientRect();
      var hit = document.elementFromPoint(r.left + r.width / 2, Math.min(r.top + 20, innerHeight - 1));
      if (!hit || !d.contains(hit)) return;
      if (r.width * r.height > area) { area = r.width * r.height; best = d; }
    });
    return best;
  }
  function targets() {
    var all = Array.prototype.slice.call(document.querySelectorAll(SELECTOR)).filter(visible);
    // drop elements nested inside another target (keep the outer button)
    return all.filter(function (el) { return !all.some(function (o) { return o !== el && o.contains(el); }); });
  }
  function setFocus(el) {
    if (current) current.classList.remove('tv-focus');
    current = el;
    if (!el) return;
    el.classList.add('tv-focus');
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
  }
  function center(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  function move(dir, retried) {
    var list = targets();
    if (!list.length) return;
    if (!current || !document.contains(current) || list.indexOf(current) < 0) { setFocus(list[0]); return; }
    var a = current.getBoundingClientRect(), ca = center(a), best = null, bestScore = Infinity;
    list.forEach(function (el) {
      if (el === current) return;
      var b = el.getBoundingClientRect(), cb = center(b);
      var dx = cb.x - ca.x, dy = cb.y - ca.y, main, cross;
      // centers decide the direction, so slightly overlapping buttons still count
      if (dir === 'up') { if (dy > -4 || b.top >= a.top) return; main = -dy; cross = Math.abs(dx); }
      else if (dir === 'down') { if (dy < 4 || b.bottom <= a.bottom) return; main = dy; cross = Math.abs(dx); }
      else if (dir === 'left') { if (dx > -4 || b.left >= a.left) return; main = -dx; cross = Math.abs(dy); }
      else { if (dx < 4 || b.right <= a.right) return; main = dx; cross = Math.abs(dy); }
      // a button that lines up with the current one (overlaps side to side for
      // up/down, top to bottom for left/right) has no sideways penalty
      var overlap = (dir === 'up' || dir === 'down')
        ? Math.min(a.right, b.right) - Math.max(a.left, b.left)
        : Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (overlap > 0) cross = 0;
      var score = main + cross * 2;
      if (score < bestScore) { bestScore = score; best = el; }
    });
    if (best) { setFocus(best); return; }
    // Nothing further that way on screen: scroll the list and try again.
    if ((dir === 'up' || dir === 'down') && !retried) {
      var box = scrollerOf(current);
      if (box) {
        var before = box.scrollTop;
        box.scrollTop += (dir === 'down' ? 1 : -1) * box.clientHeight * 0.6;
        if (box.scrollTop !== before) setTimeout(function () { move(dir, true); }, 60);
      }
    }
  }
  function typing(el) {
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  }
  function goBack() {
    if (exitBox) { closeExit(); return; }
    // the screen's own back button; on the first screen, ask before leaving
    var back = Array.prototype.filter.call(document.querySelectorAll('[aria-label="Go back"], [aria-label="Back"], [data-testid="header-back"]'), visible)[0];
    if (back) { back.click(); return; }
    openExit();
  }

  // TV stores (Samsung, LG) require the app's own "leave?" popup on Back.
  var APP_NAME = 'Home Survival Kit';
  var exitBox = null, beforeExit = null;
  function openExit() {
    beforeExit = current;
    exitBox = document.createElement('div');
    exitBox.className = 'tv-exit';
    exitBox.innerHTML = '<div class="tv-exit-card" role="dialog" aria-label="Leave ' + APP_NAME + '?">' +
      '<div class="tv-exit-title">Leave ' + APP_NAME + '?</div>' +
      '<div class="tv-exit-row"><div role="button" tabindex="0" class="tv-exit-btn tv-exit-stay">Stay</div>' +
      '<div role="button" tabindex="0" class="tv-exit-btn tv-exit-leave">Exit</div></div></div>';
    document.body.appendChild(exitBox);
    exitBox.querySelector('.tv-exit-stay').addEventListener('click', closeExit);
    exitBox.querySelector('.tv-exit-leave').addEventListener('click', exitApp);
    setFocus(exitBox.querySelector('.tv-exit-stay'));
  }
  function closeExit() {
    if (exitBox) exitBox.remove();
    exitBox = null;
    setFocus(beforeExit && document.contains(beforeExit) ? beforeExit : null);
  }
  function exitApp() {
    try { if (window.tizen) { tizen.application.getCurrentApplication().exit(); return; } } catch (e) {}
    try { if (window.TvApp && TvApp.exit) { TvApp.exit(); return; } } catch (e) {} // Android TV / Fire TV wrapper
    window.close(); // webOS and browsers
  }

  // Android TV / Fire TV: the app passes the remote's Back button here
  window.tvBack = goBack;

  var KEYS = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' };
  document.addEventListener('keydown', function (e) {
    var dir = KEYS[e.keyCode];
    if (dir) {
      if (typing(document.activeElement) && (dir === 'left' || dir === 'right')) return;
      e.preventDefault(); move(dir); return;
    }
    // OK presses the selected button exactly once (the app's buttons also react to
    // Enter on their own, which would press checkboxes twice).
    if (e.keyCode === 13 && current && !typing(current)) { e.preventDefault(); e.stopPropagation(); current.click(); return; }
    // Back: Escape, Backspace (outside text fields), webOS 461, Tizen 10009
    if (e.keyCode === 27 || e.keyCode === 461 || e.keyCode === 10009 || (e.keyCode === 8 && !typing(document.activeElement))) {
      e.preventDefault(); e.stopPropagation(); goBack();
    }
  }, true);

  document.addEventListener('keyup', function (e) {
    if (e.keyCode === 13 && current && !typing(current)) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  // Keep a button selected after every screen change
  new MutationObserver(function () {
    if (!current || !document.contains(current) || !visible(current)) {
      clearTimeout(window.__tvRefocus);
      window.__tvRefocus = setTimeout(function () { var t = targets(); if (t.length) setFocus(t[0]); }, 150);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  // Webos/Tizen register the remote's media keys only if asked
  try { if (window.tizen && tizen.tvinputdevice) tizen.tvinputdevice.registerKey('MediaPlayPause'); } catch (e) {}
})();
