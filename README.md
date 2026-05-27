# Jolit Backend

API REST para la tienda Jolit.

## Comandos

```bash
npm install
npm run dev
```

Por defecto levanta en `http://localhost:4000`.

## Variables de entorno

Copiá `.env.example` a `.env` y ajustá estos valores:

- `PORT`: puerto del backend.
- `FRONTEND_ORIGIN`: origenes permitidos para CORS, separados por coma.
- `ADMIN_EMAIL`: email para entrar al panel admin.
- `ADMIN_PASSWORD`: contraseña para entrar al panel admin.

En desarrollo, si no definís credenciales admin, se usan `admin@jolit.local` y
`admin123`. En producción, `ADMIN_EMAIL` y `ADMIN_PASSWORD` son obligatorios.

## Endpoints principales

- `GET /api/health`
- `GET /api/categories`
- `POST /api/categories`
- `PATCH /api/categories/:id`
- `DELETE /api/categories/:id`
- `GET /api/products`
- `GET /api/products/:slug`
- `POST /api/products`
- `PATCH /api/products/:id`
- `DELETE /api/products/:id`
- `GET /api/orders`
- `GET /api/orders/:id`
- `POST /api/orders`
- `POST /api/orders/lookup`
- `PATCH /api/orders/:id/status`

El backend usa `src/data/db.json` como persistencia inicial para poder arrancar sin base de datos.
