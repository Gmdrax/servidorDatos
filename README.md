# 🔒 Servidor Datos — Servidor privado de archivos remotos

Servidor ligero y seguro para acceder a tus archivos y fotos desde cualquier lugar mediante una interfaz web autenticada. Construido con **Node.js/Express** con explorador de archivos integrado y galería de fotos.

---

## Características

- **Autenticación por contraseña** con hash bcrypt (sin usuarios en base de datos).
- **Explorador de archivos integrado** — navega carpetas, descarga archivos y visualiza fotos sin dependencias externas.
- **Galería de fotos** — miniaturas, modo solo-fotos y lightbox para ver imágenes a pantalla completa con navegación por teclado.
- **Gestión de sesiones segura** con `express-session` y almacenamiento en fichero.
- **Rate limiting** en el endpoint de login (máx. 10 intentos / 15 min).
- **Headers de seguridad HTTP** mediante `helmet`.
- **Protección frente a path traversal** — el explorador solo sirve archivos bajo `DATA_ROOT`.
- **Proxy opcional** hacia File Browser (compatible con versiones anteriores).
- **Bajo consumo de RAM**: preparado para equipos con 2 GB de RAM.

---

## Requisitos

| Componente | Versión mínima |
|---|---|
| Node.js | 18.x |
| npm | 9.x |
| Sistema operativo | Linux (probado en Linux Mint) |

> **File Browser ya no es obligatorio.** El explorador de archivos integrado funciona de forma autónoma. File Browser sigue siendo compatible si ya lo tienes configurado.

---

## Instalación rápida

```bash
# 1. Clonar / descargar el proyecto
git clone <url-del-repo> servidor-datos
cd servidor-datos

# 2. Instalar dependencias Node.js
npm install

# 3. Copiar el fichero de configuración y editarlo
cp .env.example .env

# 4. Generar el hash de tu contraseña
npm run gen-hash
# → Copia el hash generado y ponlo en PASSWORD_HASH dentro de .env

# 5. Generar el secreto de sesión
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# → Copia el resultado y ponlo en SESSION_SECRET dentro de .env

# 6. Iniciar el servidor Node.js
npm start
```

Abre el navegador en `http://127.0.0.1:3000` e introduce tu contraseña.

---

## Estructura del proyecto

```
servidor-datos/
├── server/
│   ├── app.js                  # Lógica principal del servidor Express
│   └── dashboard.html          # Panel de control
├── public/
│   ├── login.html              # Página de login
│   ├── browse.html             # Explorador de archivos y galería de fotos
│   ├── browse.js               # Lógica del explorador (navegación, lightbox)
│   ├── dashboard.js            # Lógica del panel de control
│   └── styles.css              # Estilos del sistema
├── scripts/
│   ├── gen-hash.js             # Generador interactivo de hash bcrypt
│   └── start-filebrowser.sh   # Script de inicio de File Browser (opcional)
├── docs/
│   └── INSTALACION_LINUX_MINT.md  # Guía detallada de instalación
├── .env.example                # Plantilla de variables de entorno
├── .env                        # Tu configuración real (NO subir al repo)
├── .gitignore                  # Exclusiones de git
├── package.json
└── README.md
```

---

## Configuración (`.env`)

| Variable | Descripción | Requerida |
|---|---|---|
| `SESSION_SECRET` | Secreto aleatorio ≥ 32 chars para firmar sesiones | ✅ |
| `PASSWORD_HASH` | Hash bcrypt de tu contraseña | ✅ |
| `DATA_ROOT` | Carpeta raíz que sirve el explorador integrado (por defecto: `$HOME`) | ❌ |
| `FILEBROWSER_URL` | URL local de File Browser (por defecto `http://127.0.0.1:8080`) | ❌ |
| `PORT` | Puerto del servidor Node.js (por defecto `3000`) | ❌ |
| `NODE_ENV` | `production` en producción, `development` en local sin HTTPS | ❌ |

### Configurar la carpeta de archivos

Edita `DATA_ROOT` en tu `.env` para apuntar a la carpeta que quieres compartir:

```env
# Carpeta específica (disco externo, por ejemplo)
DATA_ROOT=/mnt/disco-externo

# Solo fotos
DATA_ROOT=/home/usuario/Fotos
```

---

## Cómo acceder de forma segura

### Acceso local
```
http://127.0.0.1:3000
```

### Acceso remoto con HTTPS (recomendado)

```nginx
server {
    listen 443 ssl;
    server_name tudominio.ejemplo.com;

    ssl_certificate     /etc/letsencrypt/live/tudominio.ejemplo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tudominio.ejemplo.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 0;
    }
}
```

### Acceso remoto con VPN (más privado)
Configura **WireGuard** o **Tailscale** para acceder a la red local desde el exterior sin exponer el servidor directamente a Internet. Esta es la opción **más segura**.

---

## Arranque automático con systemd

Consulta la guía detallada en [`docs/INSTALACION_LINUX_MINT.md`](docs/INSTALACION_LINUX_MINT.md).

---

## Seguridad

- La contraseña **nunca se almacena en texto plano**: solo el hash bcrypt.
- Las sesiones se almacenan en disco (`.sessions/`) y caducan a las 24 horas.
- El login tiene **rate limiting**: máximo 10 intentos fallidos por IP cada 15 minutos.
- El explorador de archivos usa **protección frente a path traversal**: todas las rutas se resuelven bajo `DATA_ROOT` y cualquier intento de salir de esa carpeta devuelve error 400.
- En producción, usa siempre HTTPS para que las cookies de sesión viajen cifradas.

---

## Limitaciones y advertencias

- **Un único usuario**: el sistema está diseñado para un solo propietario. No hay gestión de múltiples usuarios.
- **Sin 2FA**: no hay segundo factor de autenticación. Compensa esto con una contraseña muy robusta y acceso VPN.
- **Sesiones en disco**: si se llena el almacenamiento o se borran los archivos de `.sessions/`, todas las sesiones activas se invalidan.
- **No apto para múltiples instancias**: el almacenamiento de sesiones en fichero no escala horizontalmente.
- **NODE_ENV=development**: en este modo las cookies **no son seguras** (no `Secure`). Úsalo solo en red local sin HTTPS.

---

## Licencia

MIT
