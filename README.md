# 🔒 Servidor Datos — Servidor privado de archivos remotos

Servidor ligero y seguro para acceder a tus archivos desde cualquier lugar mediante una interfaz web autenticada. Construido con **Node.js/Express** como proxy autenticado sobre **File Browser**.

---

## Características

- **Autenticación por contraseña** con hash bcrypt (sin usuarios en base de datos).
- **Gestión de sesiones segura** con `express-session` y almacenamiento en fichero.
- **Rate limiting** en el endpoint de login (máx. 10 intentos / 15 min).
- **Headers de seguridad HTTP** mediante `helmet`.
- **Proxy transparente** hacia File Browser, solo accesible tras autenticación.
- **Interfaz mínima**: formulario de login estático y toda la gestión de archivos delegada a File Browser.
- **Bajo consumo de RAM**: preparado para equipos con 2 GB de RAM.

---

## Requisitos

| Componente | Versión mínima |
|---|---|
| Node.js | 18.x |
| npm | 9.x |
| File Browser | 2.x |
| Sistema operativo | Linux (probado en Linux Mint) |

---

## Instalación rápida

```bash
# 1. Clonar / descargar el proyecto
git clone <url-del-repo> servidor-datos
cd servidor-datos

# 2. Instalar dependencias Node.js
npm install

# 3. Instalar File Browser
curl -fsSL https://raw.githubusercontent.com/filebrowser/get/master/get.sh -o /tmp/install-fb.sh
# Revisa el script antes de ejecutarlo, luego:
bash /tmp/install-fb.sh

# 4. Copiar el fichero de configuración y editarlo
cp .env.example .env

# 5. Generar el hash de tu contraseña
npm run gen-hash
# → Copia el hash generado y ponlo en PASSWORD_HASH dentro de .env

# 6. Generar el secreto de sesión
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# → Copia el resultado y ponlo en SESSION_SECRET dentro de .env

# 7. Iniciar File Browser (en una terminal separada o con systemd)
./scripts/start-filebrowser.sh

# 8. Iniciar el servidor Node.js
npm start
```

Abre el navegador en `http://127.0.0.1:3000` e introduce tu contraseña.

---

## Estructura del proyecto

```
servidor-datos/
├── server/
│   └── app.js                  # Lógica principal del servidor Express
├── public/
│   ├── login.html              # Página de login estática
│   └── styles.css              # Estilos mínimos
├── scripts/
│   ├── gen-hash.js             # Generador interactivo de hash bcrypt
│   └── start-filebrowser.sh   # Script de inicio de File Browser
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
| `FILEBROWSER_URL` | URL local de File Browser (por defecto `http://127.0.0.1:8080`) | ❌ |
| `PORT` | Puerto del servidor Node.js (por defecto `3000`) | ❌ |
| `NODE_ENV` | `production` en producción, `development` en local sin HTTPS | ❌ |

---

## Cómo acceder de forma segura

### Acceso local
Accede directamente desde el mismo equipo:
```
http://127.0.0.1:3000
```

### Acceso remoto con HTTPS (recomendado)
Coloca este servidor tras un proxy inverso como **Nginx** con certificado TLS (Let's Encrypt):

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
- File Browser escucha **solo en localhost** (`127.0.0.1:8080`); nunca lo expongas directamente.
- En producción, usa siempre HTTPS para que las cookies de sesión viajen cifradas.
- El campo de contraseña en el login no tiene autocompletar para reducir exposición.

---

## Limitaciones y advertencias

- **Un único usuario**: el sistema está diseñado para un solo propietario. No hay gestión de múltiples usuarios.
- **Sin 2FA**: no hay segundo factor de autenticación. Compensa esto con una contraseña muy robusta y acceso VPN.
- **Dependencia de File Browser**: si File Browser no está en ejecución, el acceso a archivos devuelve error 502. El servidor de login sigue funcionando.
- **Sesiones en disco**: si se llena el almacenamiento o se borran los archivos de `.sessions/`, todas las sesiones activas se invalidan.
- **No apto para múltiples instancias**: el almacenamiento de sesiones en fichero no escala horizontalmente.
- **NODE_ENV=development**: en este modo las cookies **no son seguras** (no `Secure`). Úsalo solo en red local sin HTTPS.

---

## Licencia

MIT
