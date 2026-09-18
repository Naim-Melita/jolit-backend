-- Dos piezas no pueden compartir codigo: si pasara, se mandaria la joya
-- equivocada. En Postgres varios NULL conviven bajo un indice unico, asi que
-- los productos que todavia no tienen codigo no molestan.
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");
