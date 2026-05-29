# Jolit Backend

API REST para el e-commerce de joyas Jolit.

## Stack

- Node.js + Express + TypeScript
- PostgreSQL + Prisma
- Clerk para usuarios
- Cloudinary para imagenes
- Zod para validaciones

## Comandos

```bash
npm install
npm.cmd run dev
```

Por defecto levanta en:

```txt
http://localhost:4000
```

## Base De Datos

Configurar `DATABASE_URL` en `.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/jolit?schema=public"
```

Desarrollo:

```bash
npm.cmd run prisma:migrate
npm.cmd run prisma:seed
npm.cmd run prisma:studio
```

Produccion:

```bash
npm.cmd run prisma:deploy
npm.cmd run build
npm.cmd start
```

`src/data/db.json` queda solo como fuente historica para `prisma/seed.ts`; no se usa en runtime.

## Variables De Entorno

Copiar `.env.example` a `.env` y completar:

```env
NODE_ENV=development
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
DATABASE_URL=

ADMIN_EMAIL=
ADMIN_PASSWORD=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=jolit/products

CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
CLERK_ADMIN_EMAILS=
```

## Endpoints Principales

Publicos:

```txt
GET /api/health
GET /api/categories
GET /api/products
GET /api/products/:slug
POST /api/orders
POST /api/orders/lookup
GET /api/settings
POST /api/shipping/quote
```

Usuario Clerk:

```txt
GET /api/customers/me
GET /api/favorites
POST /api/favorites/:productId
DELETE /api/favorites/:productId
GET /api/cart
POST /api/cart/items
PATCH /api/cart/items/:productId
DELETE /api/cart/items/:productId
DELETE /api/cart
GET /api/me/orders
GET /api/me/orders/:id
```

Admin:

```txt
POST /api/auth/login
GET /api/auth/me
PATCH /api/auth/password
POST /api/categories
PATCH /api/categories/:id
DELETE /api/categories/:id
POST /api/products
PATCH /api/products/:id
DELETE /api/products/:id
GET /api/orders
GET /api/orders/:id
PATCH /api/orders/:id/status
PATCH /api/orders/:id/shipping
PATCH /api/settings
POST /api/uploads
```

Webhooks:

```txt
POST /api/webhooks/clerk
```

## Clerk Webhook

En Clerk Dashboard crear un endpoint:

```txt
https://TU_BACKEND/api/webhooks/clerk
```

Eventos:

```txt
user.created
user.updated
user.deleted
```

Copiar el signing secret en:

```env
CLERK_WEBHOOK_SECRET=
```
