# Guía de instalación — Linux Mint

Esta guía cubre la instalación y configuración completa del **Servidor Datos** en un equipo con **Linux Mint** (20.x / 21.x / 22.x) y **2 GB de RAM**.

---

## Índice

1. [Requisitos del sistema](#1-requisitos-del-sistema)
2. [Instalar Node.js](#2-instalar-nodejs)
3. [Instalar File Browser](#3-instalar-file-browser)
4. [Descargar e instalar el proyecto](#4-descargar-e-instalar-el-proyecto)
5. [Configurar las variables de entorno](#5-configurar-las-variables-de-entorno)
6. [Configurar la contraseña](#6-configurar-la-contraseña)
7. [Ejecutar manualmente (pruebas)](#7-ejecutar-manualmente-pruebas)
8. [Arranque automático con systemd](#8-arranque-automático-con-systemd)
9. [Acceso seguro desde Internet](#9-acceso-seguro-desde-internet)
10. [Endurecimiento del sistema y firewall](#10-endurecimiento-del-sistema-y-firewall)
11. [Estructura del proyecto y ejemplos de uso](#11-estructura-del-proyecto-y-ejemplos-de-uso)
12. [Limitaciones y advertencias](#12-limitaciones-y-advertencias)

---

## 1. Requisitos del sistema

- Linux Mint 20, 21 o 22 (o Ubuntu 20.04+).
- 2 GB de RAM (consumo estimado en reposo: ~80–120 MB).
- Acceso a Internet para la instalación.
- Usuario con permisos `sudo`.

---

## 2. Instalar Node.js

Se recomienda instalar Node.js a través del gestor de versiones **nvm** para poder actualizar fácilmente y no usar `sudo` con npm.

```bash
# Instalar nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Recargar la configuración del shell
source ~/.bashrc   # o source ~/.zshrc si usas zsh

# Instalar la versión LTS de Node.js
nvm install --lts
nvm use --lts

# Verificar la instalación
node --version   # debe mostrar v20.x.x o superior
npm --version
```

> **Alternativa sin nvm**: puedes instalar Node.js desde el repositorio oficial de NodeSource:
> ```bash
> curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
> sudo apt-get install -y nodejs
> ```

---

## 3. Instalar File Browser

File Browser es una interfaz web de gestión de archivos. Se distribuye como un único binario ejecutable.

```bash
# Descargar e instalar el binario oficial
curl -fsSL https://raw.githubusercontent.com/filebrowser/get/master/get.sh | bash

# El binario se instala en /usr/local/bin/filebrowser
filebrowser version
```

### Configuración inicial de File Browser

Antes de la primera ejecución, configura el modo sin autenticación (la autenticación la gestiona el servidor Node.js):

```bash
# Crear directorio de configuración
mkdir -p ~/.config/filebrowser

# Inicializar la base de datos y deshabilitar la autenticación interna
filebrowser config init --database ~/.config/filebrowser/filebrowser.db
filebrowser config set --auth.method=noauth --database ~/.config/filebrowser/filebrowser.db
```

> **Importante**: File Browser debe escuchar **solo en localhost** (`127.0.0.1`). Nunca lo expongas directamente a Internet.

---

## 4. Descargar e instalar el proyecto

```bash
# Opción A: clonar con git
git clone <url-del-repo> ~/servidor-datos
cd ~/servidor-datos

# Opción B: descargar el ZIP y descomprimir
unzip servidor-datos.zip -d ~/servidor-datos
cd ~/servidor-datos

# Instalar dependencias Node.js
npm install
```

---

## 5. Configurar las variables de entorno

```bash
# Copiar la plantilla
cp .env.example .env

# Abrir el editor para configurar
nano .env
```

Rellena los siguientes valores en `.env`:

### SESSION_SECRET

Genera una cadena aleatoria segura:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copia el resultado y asígnalo a `SESSION_SECRET` en `.env`.

### FILEBROWSER_URL, PORT, NODE_ENV

- `FILEBROWSER_URL=http://127.0.0.1:8080` (no cambiar salvo configuración especial).
- `PORT=3000` (puerto del servidor Node.js).
- `NODE_ENV=production` si usas HTTPS. Usa `development` solo en pruebas locales sin HTTPS.

---

## 6. Configurar la contraseña

```bash
npm run gen-hash
```

El script pedirá la contraseña dos veces (sin mostrarla en pantalla) y generará el hash bcrypt. Copia la línea `PASSWORD_HASH=...` en tu archivo `.env`.

**Ejemplo de `.env` completo:**

```env
SESSION_SECRET=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
PASSWORD_HASH=$2b$12$xyz...
FILEBROWSER_URL=http://127.0.0.1:8080
PORT=3000
NODE_ENV=production
```

---

## 7. Ejecutar manualmente (pruebas)

Abre **dos terminales**:

**Terminal 1 — File Browser:**
```bash
cd ~/servidor-datos
./scripts/start-filebrowser.sh
```

**Terminal 2 — Servidor Node.js:**
```bash
cd ~/servidor-datos
npm start
```

Accede desde el navegador a `http://127.0.0.1:3000` e introduce la contraseña.

---

## 8. Arranque automático con systemd

Configura dos servicios systemd para que ambos procesos se inicien automáticamente al arrancar el sistema.

### 8.1 Servicio para File Browser

Crea el archivo de servicio:

```bash
sudo nano /etc/systemd/system/filebrowser.service
```

Contenido (ajusta `User`, `FB_ROOT` y rutas según tu configuración):

```ini
[Unit]
Description=File Browser
After=network.target

[Service]
Type=simple
User=TU_USUARIO
Environment=FB_ROOT=/home/TU_USUARIO
Environment=FB_ADDRESS=127.0.0.1
Environment=FB_PORT=8080
Environment=FB_DATABASE=/home/TU_USUARIO/.config/filebrowser/filebrowser.db
ExecStart=/home/TU_USUARIO/servidor-datos/scripts/start-filebrowser.sh
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 8.2 Servicio para el servidor Node.js

```bash
sudo nano /etc/systemd/system/servidor-datos.service
```

Contenido:

```ini
[Unit]
Description=Servidor Datos (proxy Node.js)
After=network.target filebrowser.service
Requires=filebrowser.service

[Service]
Type=simple
User=TU_USUARIO
WorkingDirectory=/home/TU_USUARIO/servidor-datos
EnvironmentFile=/home/TU_USUARIO/servidor-datos/.env
ExecStart=/usr/bin/node server/app.js
Restart=on-failure
RestartSec=5

# Restricciones de seguridad adicionales
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/TU_USUARIO/servidor-datos/.sessions

[Install]
WantedBy=multi-user.target
```

> Si usas **nvm**, necesitas la ruta absoluta al binario de Node.js de esa instalación. Encuéntrala con `which node` estando activo nvm. Por ejemplo: `/home/TU_USUARIO/.nvm/versions/node/v20.17.0/bin/node`.

### 8.3 Habilitar e iniciar los servicios

```bash
# Recargar la configuración de systemd
sudo systemctl daemon-reload

# Habilitar el inicio automático
sudo systemctl enable filebrowser.service
sudo systemctl enable servidor-datos.service

# Iniciar ahora
sudo systemctl start filebrowser.service
sudo systemctl start servidor-datos.service

# Verificar el estado
sudo systemctl status filebrowser.service
sudo systemctl status servidor-datos.service

# Ver logs en tiempo real
sudo journalctl -u servidor-datos.service -f
```

---

## 9. Acceso seguro desde Internet

### Opción A: VPN (más segura, recomendada)

Instala **Tailscale** o **WireGuard** para acceder de forma privada sin exponer ningún puerto:

```bash
# Tailscale (más sencillo)
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Con Tailscale activo, accede usando la IP de la red privada de Tailscale desde cualquier dispositivo donde también tengas Tailscale instalado.

### Opción B: Proxy inverso Nginx + HTTPS

Instala Nginx y Certbot:

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

Configura Nginx como proxy inverso:

```bash
sudo nano /etc/nginx/sites-available/servidor-datos
```

Contenido:

```nginx
server {
    listen 80;
    server_name tudominio.ejemplo.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name tudominio.ejemplo.com;

    ssl_certificate     /etc/letsencrypt/live/tudominio.ejemplo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tudominio.ejemplo.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Cabecera HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection keep-alive;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 0;  # sin límite de subida
    }
}
```

Activar y obtener certificado:

```bash
sudo ln -s /etc/nginx/sites-available/servidor-datos /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d tudominio.ejemplo.com
```

### Apertura de puertos en el router

Si usas la opción Nginx+HTTPS, abre el **puerto 443** (TCP) en tu router y apúntalo a la IP local del equipo. **No abras el puerto 3000 directamente.**

---

## 10. Endurecimiento del sistema y firewall

### UFW (cortafuegos)

```bash
# Instalar ufw si no está disponible
sudo apt install -y ufw

# Política por defecto: denegar entrante, permitir saliente
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Permitir SSH (ajusta el puerto si lo has cambiado)
sudo ufw allow 22/tcp

# Permitir HTTPS (solo si usas Nginx+HTTPS)
sudo ufw allow 443/tcp

# Activar el firewall
sudo ufw enable
sudo ufw status verbose
```

> **No abras** los puertos 3000 ni 8080 en el firewall. Estos servicios solo deben escuchar en localhost.

### Otras recomendaciones

- **Actualiza regularmente**: `sudo apt update && sudo apt upgrade -y`.
- **Deshabilita el acceso root por SSH**: edita `/etc/ssh/sshd_config` y establece `PermitRootLogin no`.
- **Usa autenticación SSH por clave pública** en lugar de contraseña.
- **Fail2ban**: instala `sudo apt install fail2ban` para bloquear IPs con múltiples intentos fallidos de SSH.
- **Cambia la contraseña periódicamente**: ejecuta `npm run gen-hash` y actualiza `.env` + reinicia el servicio.
- **Copias de seguridad**: haz copias de `.env` en un lugar seguro (fuera del equipo).
- **Monitorización**: consulta `sudo journalctl -u servidor-datos -n 100` para revisar logs.

---

## 11. Estructura del proyecto y ejemplos de uso

```
servidor-datos/
├── server/app.js          # Servidor Express: sesiones, auth, proxy
├── public/login.html      # Formulario de login
├── public/styles.css      # Estilos del login
├── scripts/
│   ├── gen-hash.js        # Genera PASSWORD_HASH para .env
│   └── start-filebrowser.sh  # Inicia File Browser
├── docs/
│   └── INSTALACION_LINUX_MINT.md
├── .env.example           # Plantilla de configuración
├── .env                   # Configuración real (NO commitear)
├── .sessions/             # Sesiones activas (generado automáticamente)
└── package.json
```

### Flujo de acceso

```
Usuario (navegador)
       │
       ▼
   [Nginx/HTTPS]  ──(opcional)──▶  puerto 443
       │
       ▼
  Node.js :3000
  ┌──────────────┐
  │  GET /       │──▶ redirige a /login
  │  GET /login  │──▶ sirve login.html
  │  POST /login │──▶ verifica bcrypt hash
  │              │    → sesión creada → redirige a /files/
  │  GET /files/*│──▶ (si autenticado) proxy a File Browser
  │              │──▶ (si no auth)     redirige a /login
  │  GET /logout │──▶ destruye sesión → redirige a /login
  └──────────────┘
       │
       ▼
  File Browser :8080 (solo localhost)
```

### Cambiar la carpeta servida

Edita la variable `FB_ROOT` en el script o en el servicio systemd:

```bash
# En scripts/start-filebrowser.sh
FB_ROOT="/mnt/disco-externo"

# O como variable de entorno antes de ejecutar
FB_ROOT=/mnt/disco-externo ./scripts/start-filebrowser.sh
```

### Cambiar la contraseña

```bash
npm run gen-hash
# Actualiza PASSWORD_HASH en .env
sudo systemctl restart servidor-datos.service
```

---

## 12. Limitaciones y advertencias

| Limitación | Descripción |
|---|---|
| Un solo usuario | No hay gestión multi-usuario. |
| Sin 2FA | No hay segundo factor de autenticación. Usa VPN para mayor seguridad. |
| Sesiones en disco | No escala horizontalmente. Apto para uso personal. |
| File Browser requerido | Si File Browser no está activo, los archivos no son accesibles (error 502). |
| `NODE_ENV=development` | Las cookies no son `Secure`. Solo para pruebas locales sin HTTPS. |
| Sin límite de subida por defecto | Configura `client_max_body_size` en Nginx si necesitas limitar el tamaño de subida. |
| Exposición pública | Si expones el servidor a Internet, **usa siempre HTTPS** y una contraseña robusta. |

---

*Documentación generada para Servidor Datos v1.0.0*
