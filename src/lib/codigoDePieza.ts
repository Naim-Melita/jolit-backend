/**
 * Codigo interno de cada pieza.
 *
 * Sirve para identificar una joya en el stock fisico: va escrito en el
 * paquetito y es lo que se cruza contra la lista al preparar un pedido. NO se
 * muestra en la tienda.
 *
 * Formato: tres letras de la categoria, guion, y un numero correlativo.
 *
 *   ANI-0001   COL-0042   PUL-0107
 *
 * Tres letras y no dos porque "collares" y "corbateros" darian las dos "CO",
 * y dos categorias distintas compartiendo prefijo hacen que el codigo deje de
 * decir de un vistazo que es la pieza.
 *
 * El numero es correlativo POR CATEGORIA: el primer anillo es ANI-0001
 * aunque ya existan cincuenta collares.
 */

/** Cuatro digitos alcanzan para 9999 piezas por categoria. */
const DIGITOS = 4;

/**
 * Las tres primeras letras del nombre de la categoria.
 *
 * Se probo saltear las letras que se confunden al leer (I, O, L) y salia
 * peor: "Anillos" daba "ANS", que no se parece a nada. Un prefijo que no se
 * reconoce de un vistazo pierde todo el sentido, y lo que de verdad se
 * confunde al leer un codigo son los digitos, no estas letras.
 */
export function prefijoDeCategoria(categoria: string) {
  const letras = categoria
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

  if (!letras) return "GEN";

  return letras.slice(0, 3).padEnd(3, "X");
}

/** Arma el codigo completo a partir del prefijo y el numero. */
export function armarCodigo(prefijo: string, numero: number) {
  return `${prefijo}-${String(numero).padStart(DIGITOS, "0")}`;
}

/**
 * Devuelve el numero de un codigo que ya usa este prefijo, o null si no
 * pertenece a esta serie. Sirve para saber por donde seguir contando sin
 * tropezar con codigos cargados a mano con otro formato.
 */
export function numeroDeCodigo(codigo: string, prefijo: string): number | null {
  const esperado = new RegExp(`^${prefijo}-(\\d{${DIGITOS},})$`);
  const match = codigo.trim().toUpperCase().match(esperado);

  if (!match) return null;

  const numero = Number(match[1]);

  return Number.isFinite(numero) ? numero : null;
}

/**
 * Elige el proximo codigo libre de la categoria, mirando los que ya existen.
 *
 * Toma el mayor de la serie y suma uno: no reusa los huecos que dejan las
 * piezas borradas, porque un codigo reusado apuntaria a dos joyas distintas
 * en pedidos viejos.
 */
export function siguienteCodigo(categoria: string, codigosExistentes: string[]) {
  const prefijo = prefijoDeCategoria(categoria);

  const mayor = codigosExistentes.reduce((maximo, codigo) => {
    const numero = numeroDeCodigo(codigo ?? "", prefijo);
    return numero !== null && numero > maximo ? numero : maximo;
  }, 0);

  return armarCodigo(prefijo, mayor + 1);
}

/** Normaliza lo que se carga a mano, para que no entren dos formas del mismo. */
export function normalizarCodigo(codigo: string) {
  return codigo.trim().toUpperCase().replace(/\s+/g, "");
}
