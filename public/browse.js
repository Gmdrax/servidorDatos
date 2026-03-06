'use strict';

// ── Constantes ────────────────────────────────────────────────────────────────

var IMAGE_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.avif', '.tiff', '.tif',
]);

var FILE_ICONS = {
  '.pdf': '📄', '.doc': '📝', '.docx': '📝', '.xls': '📊', '.xlsx': '📊',
  '.ppt': '📑', '.pptx': '📑', '.zip': '🗜️', '.tar': '🗜️', '.gz': '🗜️',
  '.7z': '🗜️', '.rar': '🗜️', '.mp3': '🎵', '.wav': '🎵', '.flac': '🎵',
  '.ogg': '🎵', '.mp4': '🎬', '.mkv': '🎬', '.avi': '🎬', '.mov': '🎬',
  '.txt': '📄', '.md': '📄', '.json': '📄', '.xml': '📄', '.csv': '📊',
  '.js': '📄', '.ts': '📄', '.html': '📄', '.css': '📄', '.py': '📄',
  '.sh': '📄', '.bat': '📄',
};

// ── Estado ────────────────────────────────────────────────────────────────────

var currentPath = '/';
var allEntries = [];
var photosOnly = false;
var lightboxImages = []; // lista de {name, path}
var lightboxIndex = 0;

// ── Referencias a elementos del DOM ──────────────────────────────────────────

var elLoading = document.getElementById('browse-loading');
var elError = document.getElementById('browse-error');
var elEmpty = document.getElementById('browse-empty');
var elGrid = document.getElementById('browse-grid');
var elBreadcrumb = document.getElementById('breadcrumb');
var elToggle = document.getElementById('btn-view-toggle');
var elToggleIcon = document.getElementById('btn-view-icon');
var elToggleLabel = document.getElementById('btn-view-label');
var elLightbox = document.getElementById('lightbox');
var elLbImg = document.getElementById('lb-img');
var elLbCaption = document.getElementById('lb-caption');
var elLbDownload = document.getElementById('lb-download');

// ── Utilidades ────────────────────────────────────────────────────────────────

function formatSize(bytes) {
  if (bytes === null) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}

function encodePath(p) {
  return p.split('/').map(encodeURIComponent).join('/');
}

function rawUrl(p, dl) {
  return '/raw?path=' + encodeURIComponent(p) + (dl ? '&dl=1' : '');
}

function joinPath(base, name) {
  if (base === '/') return '/' + name;
  return base.replace(/\/$/, '') + '/' + name;
}

// ── Migas de pan ──────────────────────────────────────────────────────────────

function renderBreadcrumb(p) {
  elBreadcrumb.innerHTML = '';
  var parts = p === '/' ? [] : p.replace(/^\//, '').split('/');
  var items = [{ label: '🏠 Inicio', path: '/' }];
  var accum = '';
  parts.forEach(function (part) {
    accum += '/' + part;
    items.push({ label: part, path: accum });
  });

  items.forEach(function (item, idx) {
    var span = document.createElement('span');
    span.className = 'breadcrumb__item';
    if (idx === items.length - 1) {
      span.className += ' breadcrumb__item--active';
      span.textContent = item.label;
      span.setAttribute('aria-current', 'page');
    } else {
      var a = document.createElement('a');
      a.href = '#';
      a.className = 'breadcrumb__link';
      a.textContent = item.label;
      a.dataset.path = item.path;
      a.addEventListener('click', function (e) {
        e.preventDefault();
        navigate(this.dataset.path);
      });
      span.appendChild(a);
    }
    elBreadcrumb.appendChild(span);

    if (idx < items.length - 1) {
      var sep = document.createElement('span');
      sep.className = 'breadcrumb__sep';
      sep.setAttribute('aria-hidden', 'true');
      sep.textContent = '/';
      elBreadcrumb.appendChild(sep);
    }
  });
}

// ── Cuadrícula ────────────────────────────────────────────────────────────────

function renderGrid(entries) {
  elGrid.innerHTML = '';
  lightboxImages = [];

  var visible = photosOnly
    ? entries.filter(function (e) { return e.isImage; })
    : entries;

  if (visible.length === 0) {
    elGrid.hidden = true;
    elEmpty.hidden = false;
    return;
  }
  elEmpty.hidden = true;
  elGrid.hidden = false;

  // Reconstruir lista de imágenes para el lightbox
  entries.forEach(function (e) {
    if (e.isImage) {
      lightboxImages.push({
        name: e.name,
        path: joinPath(currentPath, e.name),
      });
    }
  });

  visible.forEach(function (entry) {
    var card = document.createElement('div');
    card.className = 'file-card';
    if (entry.type === 'directory') {
      card.className += ' file-card--dir';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', 'Abrir carpeta ' + entry.name);
      card.innerHTML =
        '<span class="file-card__thumb file-card__thumb--dir" aria-hidden="true">📁</span>' +
        '<span class="file-card__name">' + escapeHtml(entry.name) + '</span>';
      card.addEventListener('click', function () {
        navigate(joinPath(currentPath, entry.name));
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(joinPath(currentPath, entry.name));
        }
      });
    } else if (entry.isImage) {
      var imgPath = joinPath(currentPath, entry.name);
      var imgIdx = lightboxImages.findIndex(function (i) {
        return i.path === imgPath;
      });
      card.className += ' file-card--image';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', 'Ver imagen ' + entry.name);
      var img = document.createElement('img');
      img.className = 'file-card__thumb file-card__thumb--img';
      img.src = rawUrl(imgPath, false);
      img.alt = entry.name;
      img.loading = 'lazy';
      img.decoding = 'async';
      var nameEl = document.createElement('span');
      nameEl.className = 'file-card__name';
      nameEl.textContent = entry.name;
      card.appendChild(img);
      card.appendChild(nameEl);
      card.addEventListener('click', function () {
        openLightbox(imgIdx);
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightbox(imgIdx);
        }
      });
    } else {
      var filePath = joinPath(currentPath, entry.name);
      var icon = FILE_ICONS[entry.ext] || '📄';
      card.className += ' file-card--file';
      card.innerHTML =
        '<span class="file-card__thumb file-card__thumb--file" aria-hidden="true">' + icon + '</span>' +
        '<span class="file-card__name">' + escapeHtml(entry.name) + '</span>' +
        (entry.size !== null
          ? '<span class="file-card__size">' + formatSize(entry.size) + '</span>'
          : '') +
        '<a class="file-card__dl" href="' + rawUrl(filePath, true) +
        '" download="' + escapeAttr(entry.name) + '" aria-label="Descargar ' +
        escapeAttr(entry.name) + '" title="Descargar">⬇</a>';
    }
    elGrid.appendChild(card);
  });
}

// ── Navegación ────────────────────────────────────────────────────────────────

function navigate(p) {
  currentPath = p;
  history.pushState({ path: p }, '', '?path=' + encodeURIComponent(p));
  loadDirectory(p);
}

function loadDirectory(p) {
  elLoading.hidden = false;
  elError.hidden = true;
  elGrid.hidden = true;
  elEmpty.hidden = true;

  fetch('/api/browse?path=' + encodeURIComponent(p))
    .then(function (r) {
      if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || 'HTTP ' + r.status); });
      return r.json();
    })
    .then(function (data) {
      elLoading.hidden = true;
      allEntries = data.entries;
      renderBreadcrumb(data.path);
      renderGrid(allEntries);
    })
    .catch(function (err) {
      elLoading.hidden = true;
      var msg = err && err.message && err.message !== 'Failed to fetch'
        ? err.message
        : 'No se pudo conectar con el servidor. Verifica tu sesión y conexión de red.';
      elError.textContent = '❌ Error: ' + msg;
      elError.hidden = false;
    });
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

function openLightbox(idx) {
  if (lightboxImages.length === 0) return;
  lightboxIndex = idx;
  showLightboxImage(lightboxIndex);
  elLightbox.hidden = false;
  document.body.style.overflow = 'hidden';
  document.getElementById('lb-close').focus();
}

function closeLightbox() {
  elLightbox.hidden = true;
  document.body.style.overflow = '';
}

function showLightboxImage(idx) {
  var entry = lightboxImages[idx];
  elLbImg.src = rawUrl(entry.path, false);
  elLbImg.alt = entry.name;
  elLbCaption.textContent = entry.name;
  elLbDownload.href = rawUrl(entry.path, true);
  elLbDownload.download = entry.name;
  document.getElementById('lb-prev').disabled = idx === 0;
  document.getElementById('lb-next').disabled = idx === lightboxImages.length - 1;
}

document.getElementById('lb-close').addEventListener('click', closeLightbox);
document.getElementById('lb-prev').addEventListener('click', function () {
  if (lightboxIndex > 0) {
    lightboxIndex--;
    showLightboxImage(lightboxIndex);
  }
});
document.getElementById('lb-next').addEventListener('click', function () {
  if (lightboxIndex < lightboxImages.length - 1) {
    lightboxIndex++;
    showLightboxImage(lightboxIndex);
  }
});
elLightbox.addEventListener('click', function (e) {
  if (e.target === elLightbox) closeLightbox();
});

// Navegación con teclado en el lightbox
document.addEventListener('keydown', function (e) {
  if (elLightbox.hidden) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft' && lightboxIndex > 0) {
    lightboxIndex--;
    showLightboxImage(lightboxIndex);
  }
  if (e.key === 'ArrowRight' && lightboxIndex < lightboxImages.length - 1) {
    lightboxIndex++;
    showLightboxImage(lightboxIndex);
  }
});

// ── Toggle vista ──────────────────────────────────────────────────────────────

elToggle.addEventListener('click', function () {
  photosOnly = !photosOnly;
  elToggle.setAttribute('aria-pressed', String(photosOnly));
  if (photosOnly) {
    elToggleIcon.textContent = '📂';
    elToggleLabel.textContent = 'Todos';
  } else {
    elToggleIcon.textContent = '🖼️';
    elToggleLabel.textContent = 'Solo fotos';
  }
  renderGrid(allEntries);
});

// ── Historial del navegador ───────────────────────────────────────────────────

window.addEventListener('popstate', function (e) {
  var p = (e.state && e.state.path) || '/';
  currentPath = p;
  loadDirectory(p);
});

// ── Seguridad: escape de HTML ─────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Inicio ────────────────────────────────────────────────────────────────────

(function init() {
  var params = new URLSearchParams(window.location.search);
  var p = params.get('path') || '/';
  currentPath = p;
  loadDirectory(p);
})();
