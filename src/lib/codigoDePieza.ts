/**
 * Codigo interno de cada pieza.
 *
 * Sirve para identificar una joya en el stock fisico: va escrito en el
 * paquetito y es lo que se cruza contra la lista al preparar un pedido. NO se
 * muestra en la tienda.
 *
 * Formato: tres letras del tipo de pieza, tres del material, y un numero
 * correlativo.
 *
 *   ARO-BLA-0001   aros de acero blanco
 *   ARO-PLA-0001   los mismos aros, en plata 925
 *   ANI-DOR-0007   anillos de acero dorado
 *
 * Tres letras y no dos porque "collares" y "corbateros" darian las dos "CO",
 * y dos series compartiendo prefijo hacen que el codigo deje de decir de un
 * vistazo que es la pieza.
 *
 * El numero es correlativo POR SERIE, o sea por cada par tipo + material: el
 * primer aro de plata es ARO-PLA-0001 aunque ya existan cincuenta de acero.
 *
 * Las piezas cargadas antes de que existiera el material no tienen ninguno y
 * su codigo queda en el formato viejo, ARO-0001. Los dos conviven: lo unico
 * que el codigo tiene que ser es unico.
 */

/** Cuatro digitos alcanzan para 9999 piezas por serie. */
const DIGITOS = 4;

const soloLetras = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

/**
 * Prefijo de una categoria: las tres primeras letras del nombre.
 *
 * En un tipo de pieza la palabra que lo distingue va primero: "Aros",
 * "Anillos", "Tobilleras".
 *
 * Se probo saltear las letras que se confunden al leer (I, O, L) y salia
 * peor: "Anillos" daba "ANS", que no se parece a nada. Un prefijo que no se
 * reconoce de un vistazo pierde todo el sentido, y lo que de verdad se
 * confunde al leer un codigo son los digitos, no estas letras.
 */
export function prefijoDeCategoria(nombre: string) {
  const letras = soloLetras(nombre);

  if (!letras) return "GEN";

  return letras.slice(0, 3).padEnd(3, "X");
}

/**
 * Prefijo de un material: las tres primeras letras de su ULTIMA palabra.
 *
 * Al reves que en las categorias, y a proposito. En un material la palabra
 * que lo distingue va al final: "Acero blanco" y "Acero dorado" empiezan
 * igual, y con las tres primeras letras los dos darian "ACE". Mirando la
 * ultima palabra quedan BLA y DOR, que se reconocen solos.
 *
 * "Plata 925" da PLA porque el 925 no tiene letras y se descarta.
 */
export function prefijoDeMaterial(nombre: string) {
  const palabras = nombre
    .split(/\s+/)
    .map(soloLetras)
    .filter(Boolean);

  if (palabras.length === 0) return "GEN";

  return palabras[palabras.length - 1].slice(0, 3).padEnd(3, "X");
}

/**
 * La parte del codigo que identifica la serie, sin el numero.
 *
 * Sin material queda solo el de la categoria, que es el formato con el que se
 * cargaron las primeras piezas.
 */
export function serieDe(prefijoCategoria: string, prefijoMaterial?: string | null) {
  return prefijoMaterial ? `${prefijoCategoria}-${prefijoMaterial}` : prefijoCategoria;
}

/** Arma el codigo completo a partir de la serie y el numero. */
export function armarCodigo(serie: string, numero: number) {
  return `${serie}-${String(numero).padStart(DIGITOS, "0")}`;
}

/**
 * Devuelve el numero de un codigo que pertenece a esta serie, o null si no.
 * Sirve para saber por donde seguir contando sin tropezar con codigos
 * cargados a mano con otro formato.
 */
export function numeroDeCodigo(codigo: string, serie: string): number | null {
  const esperado = new RegExp(`^${serie}-(\\d{${DIGITOS},})$`);
  const match = codigo.trim().toUpperCase().match(esperado);

  if (!match) return null;

  const numero = Number(match[1]);

  return Number.isFinite(numero) ? numero : null;
}

/**
 * Elige el proximo codigo libre de la serie, mirando los que ya existen.
 *
 * Toma el mayor y suma uno: no reusa los huecos que dejan las piezas
 * borradas, porque un codigo reusado apuntaria a dos joyas distintas en
 * pedidos viejos, que ya estan impresos en comprobantes.
 */
export function siguienteCodigo(
  prefijoCategoria: string,
  prefijoMaterial: string | null | undefined,
  codigosExistentes: string[]
) {
  const serie = serieDe(prefijoCategoria, prefijoMaterial);

  const mayor = codigosExistentes.reduce((maximo, codigo) => {
    const numero = numeroDeCodigo(codigo ?? "", serie);
    return numero !== null && numero > maximo ? numero : maximo;
  }, 0);

  return armarCodigo(serie, mayor + 1);
}

/** Normaliza lo que se carga a mano, para que no entren dos formas del mismo. */
export function normalizarCodigo(codigo: string) {
  return codigo.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Un prefijo libre a partir del nombre, esquivando los que ya se usan.
 *
 * Si el natural esta tomado, se numera desde la segunda letra: COL, CO2, CO3.
 * Es lo mismo que hace la migracion que creo la columna, para que un prefijo
 * no dependa de si la categoria se creo antes o despues del cambio.
 */
export function prefijoLibre(
  propuesto: string,
  tomados: Iterable<string>
): string {
  const usados = new Set([...tomados].map((p) => p.trim().toUpperCase()));

  if (!usados.has(propuesto)) return propuesto;

  for (let n = 2; n <= 9; n += 1) {
    const variante = `${propuesto.slice(0, 2)}${n}`;
    if (!usados.has(variante)) return variante;
  }

  throw new Error(`No queda prefijo libre parecido a ${propuesto}`);
}
