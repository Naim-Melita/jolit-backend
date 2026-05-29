# Local QA

Checklist para validar Jolit backend antes de deploy.

## 1. PostgreSQL Local

Confirmar que `.env` apunta a la base local:

```env
DATABASE_URL="postgresql://postgres:root@localhost:5432/jolit?schema=public"
```

Aplicar migraciones pendientes en modo produccion:

```bash
npm.cmd run prisma:deploy
```

Cargar datos iniciales si hace falta:

```bash
npm.cmd run prisma:seed
```

## 2. Verificacion De Codigo

```bash
npm.cmd run verify
```

Equivale a:

```bash
npm.cmd run check
npm.cmd run build
```

## 3. Probar Servidor Compilado

```bash
npm.cmd start
```

Smoke test:

```txt
GET http://localhost:4000/api/health
GET http://localhost:4000/api/products
GET http://localhost:4000/api/categories
GET http://localhost:4000/api/settings
```

Rutas protegidas sin token deben responder `401`:

```txt
GET http://localhost:4000/api/favorites
GET http://localhost:4000/api/cart
GET http://localhost:4000/api/me/orders
```

## 4. Frontend Local

Con frontend en `http://localhost:5173`, probar:

- Login Clerk.
- `GET /api/customers/me`.
- Favoritos.
- Carrito persistente.
- Checkout.
- Mis pedidos.
- Upload admin a Cloudinary.

## 5. Pendiente Para Deploy

- `FRONTEND_ORIGIN` con dominio real.
- `DATABASE_URL` cloud.
- `CLERK_WEBHOOK_SECRET` real.
- Rotar secrets expuestos.
- Ejecutar `npm.cmd run prisma:deploy` en produccion.
