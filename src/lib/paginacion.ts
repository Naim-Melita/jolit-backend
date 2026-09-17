/**
 * Paginacion por cursor, igual para todos los listados.
 *
 * Antes solo la tenian los pedidos: productos, suscriptores y categorias
 * devolvian la tabla entera sin ningun tope. Con seis productos no se nota,
 * pero la idea del proyecto es que el catalogo crezca, y la lista de
 * suscriptores solo crece.
 *
 * Se usa cursor y no numero de pagina porque el catalogo cambia mientras se
 * navega: si entra un producto nuevo, con "pagina 2" se repiten o se saltean
 * filas.
 */

export type Pagina<T> = {
  items: T[];
  /** id desde el cual seguir. null cuando no queda nada mas. */
  nextCursor: number | null;
};

/** Acota lo que pide quien llama a un rango razonable. */
export function resolverLimite(
  pedido: number | undefined,
  porDefecto: number,
  maximo: number
) {
  const valor = Number.isFinite(pedido) ? Number(pedido) : porDefecto;

  return Math.min(Math.max(valor, 1), maximo);
}

/**
 * Las consultas piden una fila de mas (`take: limite + 1`) para saber si hay
 * pagina siguiente sin tener que contar toda la tabla. Esto la saca y arma la
 * respuesta.
 */
export function armarPagina<F extends { id: number }, T>(
  filas: F[],
  limite: number,
  mapear: (fila: F) => T
): Pagina<T> {
  const hayMas = filas.length > limite;
  const pagina = hayMas ? filas.slice(0, limite) : filas;

  return {
    items: pagina.map(mapear),
    nextCursor: hayMas ? pagina[pagina.length - 1].id : null,
  };
}

/**
 * Los argumentos de cursor que entiende Prisma, o nada si es la primera
 * pagina. El tipo de retorno va escrito a mano a proposito: sin eso TypeScript
 * infiere una union de dos formas distintas y Prisma no la acepta al
 * esparcirla dentro del findMany.
 */
type ArgsDeCursor = { cursor?: { id: number }; skip?: number };

export function desdeElCursor(cursor?: number): ArgsDeCursor {
  if (!cursor || !Number.isFinite(cursor)) return {};

  return { cursor: { id: cursor }, skip: 1 };
}

/** Lee limit y cursor de la query string, ignorando lo que no sea un numero. */
export function leerPaginacion(query: Record<string, unknown>) {
  const numero = (valor: unknown) => {
    const n = Number(valor);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  return {
    limit: numero(query.limit),
    cursor: numero(query.cursor),
  };
}
