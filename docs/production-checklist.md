# Production Checklist

## Secrets

- Rotar `CLERK_SECRET_KEY` si fue compartida fuera del entorno seguro.
- Rotar `CLOUDINARY_API_SECRET` si fue compartida fuera del entorno seguro.
- Configurar `DATABASE_URL` de PostgreSQL cloud.
- Configurar `CLERK_WEBHOOK_SECRET` real.
- Configurar `FRONTEND_ORIGIN` con el dominio de produccion.

Estado local actual:

```txt
Pendiente hasta deploy: rotacion de secrets
Pendiente hasta deploy o tunel publico: CLERK_WEBHOOK_SECRET real
Pendiente hasta deploy frontend: FRONTEND_ORIGIN de produccion
Pendiente hasta DB cloud: DATABASE_URL de produccion
```

## Deploy

1. Instalar dependencias:

```bash
npm install
```

2. Aplicar migraciones:

```bash
npm.cmd run prisma:deploy
```

3. Generar cliente Prisma y compilar:

```bash
npm.cmd run build
```

4. Levantar servidor:

```bash
npm.cmd start
```

## Smoke Test

```txt
GET /api/health
GET /api/products
GET /api/categories
GET /api/settings
POST /api/orders/lookup
```

## Clerk

- El frontend debe enviar `Authorization: Bearer <Clerk JWT>` para rutas de usuario.
- Configurar webhook de Clerk con eventos:
  - `user.created`
  - `user.updated`
  - `user.deleted`

## Cloudinary

- Verificar `POST /api/uploads` con usuario admin.
- Confirmar que las imagenes se guardan en `CLOUDINARY_FOLDER`.

## Base De Datos

- No usar `prisma migrate dev` en produccion.
- Usar `prisma migrate deploy`.
- Ejecutar seed solo si se quiere cargar datos iniciales o recuperar datos desde `src/data/db.json`.
