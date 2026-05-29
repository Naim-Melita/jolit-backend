# Jolit API

Base local:

```txt
http://localhost:4000
```

## Auth

Rutas de cliente:

```http
Authorization: Bearer <Clerk JWT>
```

Rutas admin:

```http
Authorization: Bearer <admin token legacy>
```

Tambien aceptan Clerk admin si el email esta en `CLERK_ADMIN_EMAILS`.

## Health

```txt
GET /api/health
```

## Products

```txt
GET /api/products
GET /api/products?category=aros
GET /api/products?search=oro
GET /api/products/:slug
POST /api/products
PATCH /api/products/:id
DELETE /api/products/:id
```

`POST/PATCH/DELETE` requieren admin.

Producto mantiene formato frontend:

```json
{
  "id": 1,
  "slug": "anillo-oro-minimal",
  "name": "Anillo Oro Minimal",
  "description": "...",
  "price": "45999.99",
  "stock": 4,
  "imageUrl": "https://...",
  "galleryImages": ["https://..."],
  "category": "anillos",
  "featured": true
}
```

## Categories

```txt
GET /api/categories
POST /api/categories
PATCH /api/categories/:id
DELETE /api/categories/:id
```

`POST/PATCH/DELETE` requieren admin.

## Orders

```txt
POST /api/orders
POST /api/orders/lookup
GET /api/orders
GET /api/orders/:id
PATCH /api/orders/:id/status
PATCH /api/orders/:id/shipping
```

`GET /api/orders`, `GET /api/orders/:id`, `PATCH status` y `PATCH shipping` requieren admin.

Crear pedido:

```json
{
  "customerName": "Cliente",
  "customerEmail": "cliente@email.com",
  "customerPhone": "1131134189",
  "shippingAddress": "Calle 123",
  "shippingCity": "Buenos Aires",
  "shippingPostalCode": "1000",
  "shippingCountry": "Argentina",
  "items": [
    {
      "productId": 1,
      "quantity": 1
    }
  ]
}
```

Si viene token Clerk, el pedido queda asociado al customer Clerk y se vacia su carrito.

Lookup publico:

```json
{
  "orderNumber": "JOL-00001",
  "contact": "cliente@email.com"
}
```

## Customer

Requiere Clerk.

```txt
GET /api/customers/me
```

Crea o actualiza el customer a partir del usuario Clerk.

## Favorites

Requiere Clerk.

```txt
GET /api/favorites
POST /api/favorites/:productId
DELETE /api/favorites/:productId
```

## Cart

Requiere Clerk.

```txt
GET /api/cart
POST /api/cart/items
PATCH /api/cart/items/:productId
DELETE /api/cart/items/:productId
DELETE /api/cart
```

Agregar item:

```json
{
  "productId": 1,
  "quantity": 1
}
```

Actualizar cantidad:

```json
{
  "quantity": 2
}
```

## My Orders

Requiere Clerk.

```txt
GET /api/me/orders
GET /api/me/orders/:id
```

Solo devuelve pedidos del customer asociado al usuario Clerk.

## Settings

```txt
GET /api/settings
PATCH /api/settings
```

`PATCH` requiere admin.

## Shipping

```txt
POST /api/shipping/quote
```

```json
{
  "postalCode": "1832",
  "city": "Lomas de Zamora",
  "subtotal": 50000,
  "quantity": 1
}
```

## Uploads

Requiere admin.

```txt
POST /api/uploads
```

`multipart/form-data`:

```txt
image=<file>
```

Respuesta:

```json
{
  "imageUrl": "https://res.cloudinary.com/...",
  "publicId": "jolit/products/...",
  "width": 1200,
  "height": 1200,
  "format": "jpg"
}
```

## Webhooks

```txt
POST /api/webhooks/clerk
```

Requiere firma Svix de Clerk.
