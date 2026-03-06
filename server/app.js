'use strict';

require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');

// ──────────────────────────────────────────────
// Validación de variables de entorno obligatorias
// ──────────────────────────────────────────────
const {
  SESSION_SECRET,
  PASSWORD_HASH,
  FILEBROWSER_URL = 'http://127.0.0.1:8080',
  PORT = '3000',
  NODE_ENV = 'production',
} = process.env;

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  console.error(
    '[ERROR] SESSION_SECRET debe estar definido y tener al menos 32 caracteres.',
  );
  process.exit(1);
}

if (!PASSWORD_HASH) {
  console.error(
    '[ERROR] PASSWORD_HASH debe estar definido. Genera un hash con: npm run gen-hash',
  );
  process.exit(1);
}

// ──────────────────────────────────────────────
// Plantilla de login (cargada una vez en memoria)
// ──────────────────────────────────────────────
const LOGIN_HTML_PATH = path.join(__dirname, '..', 'public', 'login.html');
const LOGIN_HTML_TEMPLATE = fs.readFileSync(LOGIN_HTML_PATH, 'utf8');

/** Inyecta el token CSRF en el formulario de login. */
function renderLogin(csrfToken) {
  return LOGIN_HTML_TEMPLATE.replace(
    '</form>',
    `  <input type="hidden" name="_csrf" value="${csrfToken}" />\n</form>`,
  );
}

// ──────────────────────────────────────────────
// Configuración de la aplicación Express
// ──────────────────────────────────────────────
const app = express();
const isProd = NODE_ENV === 'production';

// Headers de seguridad HTTP (helmet)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        frameSrc: ["'none'"],
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
  }),
);

// Parseo de formularios y JSON (sin body-parser extra)
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Archivos estáticos públicos (styles.css, etc.)
app.use(express.static(path.join(__dirname, '..', 'public')));

// ──────────────────────────────────────────────
// Gestión de sesiones seguras
// ──────────────────────────────────────────────
const sessionOptions = {
  store: new FileStore({
    path: path.join(__dirname, '..', '.sessions'),
    ttl: 86400, // 24 horas en segundos
    retries: 0,
    logFn: () => {}, // silenciar logs del store
  }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'sd.sid', // nombre opaco (no "connect.sid")
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProd, // HTTPS obligatorio en producción
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
  },
};

app.use(session(sessionOptions));

// ──────────────────────────────────────────────
// Rate limiting
// ──────────────────────────────────────────────

// Limiter estricto para POST /login (intentos fallidos)
const loginPostLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // ventana de 15 minutos
  max: 10, // máximo 10 intentos por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera 15 minutos.' },
  skipSuccessfulRequests: true,
});

// Limiter permisivo para GET /login (evita scraping / enumeración)
const loginGetLimiter = rateLimit({
  windowMs: 60 * 1000, // ventana de 1 minuto
  max: 30, // máximo 30 peticiones por minuto
  standardHeaders: true,
  legacyHeaders: false,
});

// ──────────────────────────────────────────────
// Middleware de autenticación
// ──────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  // Preservar la ruta original para redirigir tras login
  req.session.returnTo = req.originalUrl;
  res.redirect('/login');
}

// ──────────────────────────────────────────────
// Middleware de validación CSRF (para POST /login)
// ──────────────────────────────────────────────
function verifyCsrf(req, res, next) {
  const tokenFromSession = req.session.csrfToken;
  const tokenFromBody = req.body._csrf;

  const sessionBuf = tokenFromSession ? Buffer.from(tokenFromSession) : null;
  const bodyBuf = tokenFromBody ? Buffer.from(tokenFromBody) : null;

  const valid =
    sessionBuf !== null &&
    bodyBuf !== null &&
    sessionBuf.length === bodyBuf.length &&
    crypto.timingSafeEqual(sessionBuf, bodyBuf);

  if (!valid) {
    return res
      .status(403)
      .send(
        'Token de seguridad inválido. <a href="/login">Recarga la página</a> e inténtalo de nuevo.',
      );
  }
  next();
}

// ──────────────────────────────────────────────
// Rutas públicas: página de login
// ──────────────────────────────────────────────
app.get('/login', loginGetLimiter, (req, res) => {
  if (req.session && req.session.authenticated) {
    return res.redirect('/files/');
  }
  // Generar o reutilizar token CSRF para esta sesión
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderLogin(req.session.csrfToken));
});

app.post('/login', loginPostLimiter, verifyCsrf, async (req, res) => {
  const { password } = req.body;

  if (!password || typeof password !== 'string') {
    return res.status(400).redirect('/login');
  }

  try {
    const match = await bcrypt.compare(password, PASSWORD_HASH);
    if (match) {
      // Regenerar la sesión para prevenir session fixation
      req.session.regenerate((err) => {
        if (err) {
          console.error('[ERROR] Error al regenerar sesión:', err);
          return res.status(500).send('Error interno del servidor.');
        }
        req.session.authenticated = true;
        req.session.loggedInAt = new Date().toISOString();
        const returnTo = req.session.returnTo || '/files/';
        delete req.session.returnTo;
        res.redirect(returnTo);
      });
    } else {
      // Invalidar el token CSRF tras un intento fallido (fuerza recarga del token)
      delete req.session.csrfToken;
      // Respuesta con retardo leve para dificultar enumeración de tiempos
      setTimeout(() => {
        res.status(401).redirect('/login');
      }, 400);
    }
  } catch (err) {
    console.error('[ERROR] Error al verificar contraseña:', err);
    res.status(500).send('Error interno del servidor.');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('[ERROR] Error al destruir sesión:', err);
    }
    res.clearCookie('sd.sid');
    res.redirect('/login');
  });
});

// ──────────────────────────────────────────────
// Proxy hacia File Browser (protegido por auth)
// ──────────────────────────────────────────────
app.use(
  '/files',
  requireAuth,
  createProxyMiddleware({
    target: FILEBROWSER_URL,
    changeOrigin: true,
    pathRewrite: { '^/files': '' },
    on: {
      error: (err, req, res) => {
        console.error('[PROXY ERROR]', err.message);
        res
          .status(502)
          .send(
            '<h2>File Browser no disponible.</h2><p>Asegúrate de que File Browser está en ejecución.</p>',
          );
      },
    },
  }),
);

// Redirigir la raíz al login (o a /files/ si ya autenticado)
app.get('/', (req, res) => {
  if (req.session && req.session.authenticated) {
    return res.redirect('/files/');
  }
  res.redirect('/login');
});

// ──────────────────────────────────────────────
// Manejador de errores global
// ──────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.stack || err.message);
  res.status(500).send('Error interno del servidor.');
});

// ──────────────────────────────────────────────
// Inicio del servidor
// ──────────────────────────────────────────────
const port = parseInt(PORT, 10);
app.listen(port, '127.0.0.1', () => {
  console.log(`[INFO] Servidor escuchando en http://127.0.0.1:${port}`);
  console.log(`[INFO] Entorno: ${NODE_ENV}`);
  if (!isProd) {
    console.warn(
      '[AVISO] NODE_ENV no es "production". Las cookies no son seguras (no HTTPS).',
    );
  }
});

module.exports = app; // facilita pruebas
