/* Forever Components dashboard — preview bridge.
   Added only to the copies served under /preview/ so the dashboard can pause, resume and
   re-colour a running component. The original files under /infinite/ are never modified.
   Does nothing when the component is opened on its own. */
(function () {
  'use strict';
  var host = window.parent;
  if (!host || host === window) return;

  // Sandboxed previews have no storage. Give components a harmless in-memory stand-in.
  ['localStorage', 'sessionStorage'].forEach(function (name) {
    try {
      void window[name].length;
    } catch (e) {
      var data = {};
      var shim = {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
        setItem: function (k, v) { data[k] = String(v); },
        removeItem: function (k) { delete data[k]; },
        clear: function () { data = {}; },
        key: function (i) { return Object.keys(data)[i] || null; }
      };
      Object.defineProperty(shim, 'length', { get: function () { return Object.keys(data).length; } });
      try { Object.defineProperty(window, name, { configurable: true, value: shim }); } catch (e2) { /* leave as is */ }
    }
  });

  var paused = false;
  var realRAF = window.requestAnimationFrame.bind(window);
  var realCAF = window.cancelAnimationFrame.bind(window);
  var realTimeout = window.setTimeout.bind(window);
  var realInterval = window.setInterval.bind(window);
  var heldFrames = {};
  var heldId = 1e9;
  var heldCalls = [];
  var pausedAnimations = [];
  var pauseStyle = null;
  var bgStyle = null;

  window.requestAnimationFrame = function (cb) {
    if (!paused) return realRAF(cb);
    heldFrames[++heldId] = cb;
    return heldId;
  };
  window.cancelAnimationFrame = function (id) {
    if (heldFrames[id]) delete heldFrames[id];
    else realCAF(id);
  };
  function guarded(fn, args, keep) {
    return function () {
      if (paused) {
        if (keep) heldCalls.push(function () { fn.apply(window, args); });
        return;
      }
      fn.apply(window, args);
    };
  }
  window.setTimeout = function (fn, ms) {
    if (typeof fn !== 'function') return realTimeout(fn, ms);
    return realTimeout(guarded(fn, Array.prototype.slice.call(arguments, 2), true), ms);
  };
  window.setInterval = function (fn, ms) {
    if (typeof fn !== 'function') return realInterval(fn, ms);
    return realInterval(guarded(fn, Array.prototype.slice.call(arguments, 2), false), ms);
  };

  function eachSvg(method) {
    var list = document.querySelectorAll('svg');
    for (var i = 0; i < list.length; i++) {
      try { list[i][method](); } catch (e) { /* not animated */ }
    }
  }

  function pause() {
    if (paused) return;
    paused = true;
    pauseStyle = document.createElement('style');
    pauseStyle.textContent = '*,*::before,*::after{animation-play-state:paused!important}';
    (document.head || document.documentElement).appendChild(pauseStyle);
    eachSvg('pauseAnimations');
    try {
      pausedAnimations = document.getAnimations().filter(function (a) { return a.playState === 'running'; });
      pausedAnimations.forEach(function (a) { a.pause(); });
    } catch (e) { pausedAnimations = []; }
  }

  function resume() {
    if (!paused) return;
    paused = false;
    if (pauseStyle && pauseStyle.parentNode) pauseStyle.parentNode.removeChild(pauseStyle);
    pauseStyle = null;
    eachSvg('unpauseAnimations');
    pausedAnimations.forEach(function (a) { try { a.play(); } catch (e) { /* finished */ } });
    pausedAnimations = [];
    var frames = heldFrames;
    heldFrames = {};
    Object.keys(frames).forEach(function (id) { realRAF(frames[id]); });
    var calls = heldCalls;
    heldCalls = [];
    calls.forEach(function (run) { realTimeout(run, 0); });
  }

  function setBackground(color) {
    if (bgStyle && bgStyle.parentNode) bgStyle.parentNode.removeChild(bgStyle);
    bgStyle = null;
    if (typeof color !== 'string' || !/^#[0-9a-f]{3,8}$/i.test(color)) return;
    bgStyle = document.createElement('style');
    bgStyle.textContent = 'html,body{background:' + color + '!important}';
    (document.head || document.documentElement).appendChild(bgStyle);
  }

  window.addEventListener('message', function (event) {
    if (event.source !== host) return;
    var d = event.data;
    if (!d || typeof d.type !== 'string') return;
    if (d.type === 'fc:pause') pause();
    else if (d.type === 'fc:resume') resume();
    else if (d.type === 'fc:bg') setBackground(d.color);
  });

  function tell(message) {
    try { host.postMessage(message, '*'); } catch (e) { /* parent gone */ }
  }
  window.addEventListener('error', function (event) {
    tell({ type: 'fc:error', message: String((event && event.message) || 'Script error').slice(0, 300) });
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { tell({ type: 'fc:ready' }); });
  } else {
    tell({ type: 'fc:ready' });
  }
})();
