# Secret Rotation

Estos secretos no deben estar en chats, commits, capturas ni tickets publicos.

## Clerk

Rotar:

```env
CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET
```

Pasos:

1. Entrar a Clerk Dashboard.
2. Rotar o crear una nueva Secret Key.
3. Actualizar `CLERK_SECRET_KEY` en el hosting del backend.
4. Crear/actualizar el webhook endpoint.
5. Copiar el signing secret a `CLERK_WEBHOOK_SECRET`.
6. Reiniciar el backend.
7. Probar:

```txt
GET /api/customers/me
GET /api/favorites
GET /api/cart
```

## Cloudinary

Rotar:

```env
CLOUDINARY_API_SECRET
```

Pasos:

1. Entrar a Cloudinary Console.
2. Ir a Settings/API Keys.
3. Crear una nueva API key o rotar el secret actual.
4. Actualizar:

```env
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

5. Reiniciar backend.
6. Probar:

```txt
POST /api/uploads
```

## Database

Rotar:

```env
DATABASE_URL
```

Pasos:

1. Crear nuevo usuario/password en PostgreSQL cloud.
2. Dar permisos sobre schema `public`.
3. Actualizar `DATABASE_URL`.
4. Ejecutar:

```bash
npm.cmd run prisma:deploy
```

5. Probar:

```txt
GET /api/health
GET /api/products
```

## Admin Legacy

Rotar:

```env
ADMIN_PASSWORD
```

Importante: si ya existe un admin en `admin_accounts`, cambiar la password desde:

```txt
PATCH /api/auth/password
```

`ADMIN_PASSWORD` solo sirve para inicializar una cuenta admin si la DB no tiene una.
