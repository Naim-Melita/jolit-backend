#!/usr/bin/env bash
#
# Despliegue de la API en el servidor.
#
# Se puede correr a mano (./deploy.sh) o lo dispara GitHub al pushear a main.
# Es idempotente: correrlo dos veces seguidas no rompe nada.
#
# La configuracion NO se edita aca. Va en deploy.env, al lado de este archivo,
# que no esta versionado: este script se actualiza solo con cada despliegue y
# se llevaria puesto cualquier cambio local.
#
#   cp deploy.env.example deploy.env   (y editar deploy.env)

set -euo pipefail

# Todo el trabajo va adentro de una funcion a proposito.
#
# Bash lee el script a medida que lo ejecuta, y mas abajo hay un
# "git reset --hard" que reescribe este mismo archivo. Si el cuerpo estuviera
# suelto, bash seguiria leyendo desde un desplazamiento dentro del archivo
# NUEVO y terminaria ejecutando cualquier cosa. Dentro de una funcion, bash
# parsea todo antes de ejecutar nada y el disco ya no lo afecta.
main() {
  local aqui
  aqui="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  # shellcheck source=/dev/null
  [ -f "$aqui/deploy.env" ] && . "$aqui/deploy.env"

  local APP_DIR="${APP_DIR:-$aqui}"
  local RESTART_CMD="${RESTART_CMD:-pm2 restart jolit-api}"
  local HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:4000/api/health}"

  echo "==> Carpeta: $APP_DIR"
  cd "$APP_DIR"

  # reset --hard deja el repositorio igual a main. Descarta cambios locales en
  # archivos versionados; .env y deploy.env no se tocan porque no lo estan.
  echo "==> Bajando los cambios de main"
  git fetch origin main
  git reset --hard origin/main

  echo "==> Instalando dependencias"
  npm ci

  # Las migraciones van ANTES de levantar el codigo nuevo: si el codigo nuevo
  # espera una columna que todavia no existe, se cae al arrancar. Si no hay
  # ninguna pendiente, este comando no hace nada.
  echo "==> Aplicando migraciones de base de datos"
  npx prisma migrate deploy

  echo "==> Compilando"
  npm run build

  echo "==> Reiniciando el servicio"
  eval "$RESTART_CMD"

  # Espera a que levante y confirma que contesta, para que un despliegue roto
  # no quede marcado como exitoso.
  echo "==> Verificando"
  local intento
  for intento in $(seq 1 15); do
    if curl -fsS "$HEALTH_URL" 2>/dev/null; then
      echo
      echo "==> Listo"
      return 0
    fi
    sleep 2
  done

  echo "ERROR: la API no contesta despues de 30 segundos." >&2
  return 1
}

main "$@"
