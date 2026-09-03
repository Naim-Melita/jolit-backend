-- El numero de pedido se armaba con max(id) + 1, calculado dentro de la
-- transaccion. Dos pedidos simultaneos sacaban el mismo numero y el segundo
-- chocaba contra el indice unico: la clienta veia un error y perdia la compra.
-- Una secuencia de Postgres entrega numeros unicos aunque haya concurrencia.

CREATE SEQUENCE IF NOT EXISTS order_number_seq;

-- Arrancamos despues del numero mas alto ya emitido, para no repetir.
SELECT setval(
  'order_number_seq',
  COALESCE(
    (
      SELECT MAX(NULLIF(regexp_replace("orderNumber", '\D', '', 'g'), '')::bigint)
      FROM "orders"
    ),
    0
  ) + 1,
  false
);
