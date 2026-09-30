#!/usr/bin/env bash
#
# Despliegue de la API en el servidor.
#
# Se puede correr a mano (./deploy.sh) o lo dispara GitHub al pushear a main.
# Es idempotente: correrlo dos veces seguidas no rompe nada.
#
# Antes de usarlo, ajustar las dos variables de abajo a como esta montado el
# servidor. Todo lo demas sale del repositorio.

set -euo pipefail

# Carpeta donde esta clonado el repositorio en el servidor.
APP_DIR="${APP_DIR:-/var/www/jolit-backend}"

# Como se reinicia el proceso. Las dos formas mas comunes:
#   pm2:      "pm2 restart jolit-api"
#   systemd:  "sudo systemctl restart jolit-api"
RESTART_CMD="${RESTART_CMD:-pm2 restart jolit-api}"

echo "==> Carpeta: $APP_DIR"
cd "$APP_DIR"

echo "==> Bajando los cambios de main"
git fetch origin main
git reset --hard origin/main

echo "==> Instalando dependencias"
npm ci

# Las migraciones van ANTES de levantar el codigo nuevo: si el codigo nuevo
# espera una columna que todavia no existe, se cae al arrancar.
echo "==> Aplicando migraciones de base de datos"
npx prisma migrate deploy

echo "==> Compilando"
npm run build

echo "==> Reiniciando el servicio"
eval "$RESTART_CMD"

# Espera a que el proceso levante y confirma que contesta. Si esto falla, el
# despliegue se marca como fallido en GitHub en vez de quedar en silencio.
echo "==> Verificando"
for intento in $(seq 1 15); do
  if curl -fsS http://127.0.0.1:4000/api/health > /tmp/jolit-health.json 2>/dev/null; then
    echo "    OK: $(cat /tmp/jolit-health.json)"
    exit 0
  fi
  sleep 2
done

echo "ERROR: la API no contesta despues de 30 segundos." >&2
exit 1
