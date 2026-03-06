#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# start-filebrowser.sh
# Script para iniciar File Browser en segundo plano de forma segura.
#
# Uso:
#   chmod +x scripts/start-filebrowser.sh
#   ./scripts/start-filebrowser.sh
#
# Configuración mediante variables de entorno o editando las variables
# de la sección "CONFIGURACIÓN" al inicio de este script.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── CONFIGURACIÓN ─────────────────────────────────────────────────────────────

# Directorio raíz que File Browser servirá
FB_ROOT="${FB_ROOT:-$HOME}"

# Dirección y puerto de escucha (solo loopback, nunca 0.0.0.0)
FB_ADDRESS="${FB_ADDRESS:-127.0.0.1}"
FB_PORT="${FB_PORT:-8080}"

# Ruta de la base de datos de File Browser
FB_DATABASE="${FB_DATABASE:-$HOME/.config/filebrowser/filebrowser.db}"

# Ruta base de la URL (debe coincidir con el pathRewrite del proxy)
FB_BASEURL="${FB_BASEURL:-/}"

# Ruta al binario de File Browser
FB_BIN="${FB_BIN:-$(command -v filebrowser 2>/dev/null || echo '/usr/local/bin/filebrowser')}"

# ── VALIDACIONES ──────────────────────────────────────────────────────────────

if [[ ! -x "$FB_BIN" ]]; then
  echo "[ERROR] File Browser no encontrado o no es ejecutable en: $FB_BIN"
  echo "        Instálalo con: curl -fsSL https://raw.githubusercontent.com/filebrowser/get/master/get.sh | bash"
  echo "        O verifica los permisos con: chmod +x $FB_BIN"
  exit 1
fi

if [[ ! -d "$FB_ROOT" ]]; then
  echo "[ERROR] El directorio raíz no existe: $FB_ROOT"
  exit 1
fi

# Crear directorio de configuración si no existe
mkdir -p "$(dirname "$FB_DATABASE")"

# ── INICIO ────────────────────────────────────────────────────────────────────

echo "[INFO] Iniciando File Browser..."
echo "       Raíz:      $FB_ROOT"
echo "       Escucha:   http://$FB_ADDRESS:$FB_PORT"
echo "       Base URL:  $FB_BASEURL"
echo "       Base datos: $FB_DATABASE"
echo ""
echo "[INFO] File Browser accesible desde el proxy en /files/"
echo "       Pulsa Ctrl+C para detener."
echo ""

exec "$FB_BIN" \
  --address "$FB_ADDRESS" \
  --port    "$FB_PORT" \
  --root    "$FB_ROOT" \
  --database "$FB_DATABASE" \
  --baseurl  "$FB_BASEURL" \
  --noauth
