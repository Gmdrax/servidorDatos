'use strict';

var STATUS_POLL_INTERVAL_MS = 10000; // actualizar cada 10 s

// ── Reloj en tiempo real ──────────────────────────────────────────────────────
function updateClock() {
  var el = document.getElementById('clock');
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString('es-ES');
}
updateClock();
setInterval(updateClock, 1000);

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatUptime(seconds) {
  var d = Math.floor(seconds / 86400);
  var h = Math.floor((seconds % 86400) / 3600);
  var m = Math.floor((seconds % 3600) / 60);
  var s = seconds % 60;
  if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
  if (h > 0) return h + 'h ' + m + 'm ' + s + 's';
  return m + 'm ' + s + 's';
}

function formatDateTime(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleString('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function setText(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Cargar datos del API y actualizar UI ──────────────────────────────────────
function loadStatus() {
  fetch('/api/status')
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      // Tarjeta: sesión iniciada
      setText('session-since', formatDateTime(data.session.loggedInAt));

      // Tarjeta: uptime del servidor
      setText('server-uptime', formatUptime(data.uptime));

      // Tarjeta: memoria con barra de progreso
      var heapUsed = data.memory.heapUsed;
      var heapTotal = data.memory.heapTotal;
      var pct = heapTotal > 0 ? Math.min(100, Math.round((heapUsed / heapTotal) * 100)) : 0;
      setText('mem-used', heapUsed + ' MB / ' + heapTotal + ' MB (' + pct + '%)');
      var bar = document.getElementById('mem-bar');
      if (bar) {
        bar.style.width = pct + '%';
        bar.style.background =
          pct > 80 ? 'var(--error)' : pct > 60 ? '#f7a94f' : 'var(--accent)';
        var progressBar = bar.parentElement;
        if (progressBar) progressBar.setAttribute('aria-valuenow', String(pct));
      }

      // Actividad: login + hora actual + expiración
      setText('act-login-time', formatDateTime(data.session.loggedInAt));
      setText(
        'act-now',
        new Date(data.timestamp).toLocaleString('es-ES', {
          timeStyle: 'medium',
          dateStyle: 'short',
        }),
      );
      if (data.session.loggedInAt) {
        var elapsed = Math.floor(
          (Date.now() - new Date(data.session.loggedInAt).getTime()) / 1000,
        );
        var remaining = 86400 - elapsed;
        setText('act-expires', remaining > 0 ? formatUptime(remaining) : 'pronto');
      }

      // Tabla de estado del servidor
      setText('info-uptime', formatUptime(data.uptime));
      setText('info-rss', data.memory.rss + ' MB');
      setText('info-heap', heapUsed + ' MB');
      setText(
        'info-ts',
        new Date(data.timestamp).toLocaleTimeString('es-ES'),
      );
    })
    .catch(function (err) {
      console.error('[dashboard] Error al cargar estado:', err);
    });
}

loadStatus();
setInterval(loadStatus, STATUS_POLL_INTERVAL_MS);
