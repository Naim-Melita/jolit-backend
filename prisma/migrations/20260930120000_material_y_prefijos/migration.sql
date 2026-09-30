-- Material de la pieza, aparte de la categoria, y el prefijo con el que cada
-- una arma el codigo interno: ARO-BLA-0001.

CREATE TABLE "materials" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "materials_slug_key" ON "materials"("slug");
CREATE UNIQUE INDEX "materials_prefix_key" ON "materials"("prefix");

ALTER TABLE "products" ADD COLUMN "materialId" INTEGER;
CREATE INDEX "products_materialId_idx" ON "products"("materialId");
ALTER TABLE "products" ADD CONSTRAINT "products_materialId_fkey"
    FOREIGN KEY ("materialId") REFERENCES "materials"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- El prefijo de categoria se agrega opcional, se completa a partir del nombre
-- que ya tiene cada una, y recien ahi se vuelve obligatorio y unico. Hacerlo
-- al reves fallaria en cualquier base que ya tenga categorias cargadas.
ALTER TABLE "categories" ADD COLUMN "prefix" TEXT;

WITH calculado AS (
    SELECT
        id,
        CASE
            WHEN letras = '' THEN 'GEN'
            ELSE rpad(left(letras, 3), 3, 'X')
        END AS prefijo
    FROM (
        SELECT
            id,
            regexp_replace(
                upper(translate("name",
                    'ÁÉÍÓÚÜÑáéíóúüñ',
                    'AEIOUUNAEIOUUN')),
                '[^A-Z]', '', 'g'
            ) AS letras
        FROM "categories"
    ) AS limpio
),
-- Dos categorias podrian dar el mismo prefijo ("Collares" y "Colgantes").
-- La primera se queda con el prefijo y las demas llevan un numero, para que
-- el indice unico no rechace la migracion.
numerado AS (
    SELECT
        id,
        prefijo,
        row_number() OVER (PARTITION BY prefijo ORDER BY id) AS orden
    FROM calculado
)
UPDATE "categories" c
SET "prefix" = CASE
        WHEN n.orden = 1 THEN n.prefijo
        ELSE left(n.prefijo, 2) || n.orden::text
    END
FROM numerado n
WHERE c.id = n.id;

ALTER TABLE "categories" ALTER COLUMN "prefix" SET NOT NULL;
CREATE UNIQUE INDEX "categories_prefix_key" ON "categories"("prefix");
