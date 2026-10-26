// Runs before the app. The app sizes itself to the window, so it is told the
// window is 675px tall (a tablet-sized layout) and the page is scaled up to fill
// the TV. Everything ends up about 1.6x bigger on a 1080p TV.
(function () {
  var LAYOUT_HEIGHT = 675;
  var zoom = window.innerHeight / LAYOUT_HEIGHT;
  if (zoom <= 1) return;
  var width = Math.round(window.innerWidth / zoom);
  var fake = {
    width: width, height: LAYOUT_HEIGHT, scale: 1, offsetLeft: 0, offsetTop: 0, pageLeft: 0, pageTop: 0,
    addEventListener: function () {}, removeEventListener: function () {}
  };
  try { Object.defineProperty(window, 'visualViewport', { configurable: true, get: function () { return fake; } }); } catch (e) {}
  var css = 'html,body{width:' + width + 'px;height:' + LAYOUT_HEIGHT + 'px}body{transform:scale(' + zoom + ')}';
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  window.__tvZoom = zoom;
})();
