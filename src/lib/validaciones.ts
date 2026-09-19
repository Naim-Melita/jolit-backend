/**
 * Reglas de forma para los datos que carga una persona.
 *
 * Hasta ahora los campos solo median largo: `customerName` pedia dos
 * caracteres y `customerPhone` seis, asi que "12" pasaba como nombre y
 * "hola mundo" como telefono. El pedido entraba igual y el problema aparecia
 * despues, cuando habia que llamar a la clienta o poner un nombre en el
 * comprobante.
 *
 * El criterio es dejar pasar lo que una persona escribe de verdad y frenar
 * solo lo que no puede ser el dato pedido. Rechazar a una clienta legitima es
 * peor que aceptar un dato feo, asi que las reglas miran la forma (hay letras,
 * hay digitos suficientes) y no el contenido.
 */

/** Cuenta letras de cualquier alfabeto: "Ana", "Añez" y "Ondřej" cuentan igual. */
export function cantidadDeLetras(texto: string) {
  return (texto.match(/\p{L}/gu) ?? []).length;
}

export function soloDigitos(texto: string) {
  return texto.replace(/\D/g, "");
}

/**
 * Nombre de una persona. Pide dos letras y ningun digito.
 *
 * Los nombres reales traen acentos, apostrofes, puntos y guiones
 * ("Ma. Jose O'Brien-Perez"), asi que todo eso se acepta. Lo que no existe es
 * un nombre con numeros adentro.
 */
export function esNombreDePersona(texto: string) {
  const limpio = texto.trim();
  return cantidadDeLetras(limpio) >= 2 && !/\d/.test(limpio);
}

/**
 * Telefono de contacto. Se mide en digitos, no en caracteres, porque la gente
 * escribe "+54 9 11 2233-4455" y "1122334455" para decir lo mismo.
 *
 * Ocho digitos es un fijo del interior sin caracteristica; quince es el tope
 * de la norma internacional. Las letras se rechazan enteras: no hay forma de
 * discar "hola".
 */
export function esTelefono(texto: string) {
  const limpio = texto.trim();
  if (/\p{L}/u.test(limpio)) return false;

  const digitos = soloDigitos(limpio).length;
  return digitos >= 8 && digitos <= 15;
}

/**
 * Codigo postal argentino. Acepta las dos formas que usa el Correo:
 * el viejo de cuatro digitos ("1425") y el CPA con letras ("C1425DYB").
 *
 * Importa que sea exacto porque de aca sale la zona de envio: con seis digitos
 * cae en "interior" y se le cobra de mas a alguien de CABA.
 */
export function esCodigoPostal(texto: string) {
  const limpio = texto.trim().toUpperCase().replace(/\s+/g, "");
  return /^\d{4}$/.test(limpio) || /^[A-Z]\d{4}[A-Z]{3}$/.test(limpio);
}

/**
 * Direccion de entrega. Pide tres letras: el cartero necesita una calle, y
 * "1234" solo no lleva a ningun lado. La altura puede faltar (hay domicilios
 * sin numero), por eso no se exige ningun digito.
 */
export function esDireccion(texto: string) {
  return cantidadDeLetras(texto) >= 3;
}

/** Ciudad o localidad: dos letras alcanzan, y un numero suelto no es una ciudad. */
export function esLocalidad(texto: string) {
  return cantidadDeLetras(texto) >= 2;
}

/**
 * CUIT con su digito verificador.
 *
 * Este va en serio y no solo por la forma: el CUIT se imprime en el
 * comprobante, y un digito cambiado deja un numero que parece correcto pero no
 * es de nadie. El calculo es el modulo 11 que usa ARCA.
 *
 * (Caso real: se cargo "20366300681" cuando el valido era "27366300681".
 * Los once digitos estaban, pero el verificador no cerraba.)
 */
export function esCuit(texto: string) {
  const digitos = soloDigitos(texto);
  if (digitos.length !== 11) return false;

  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce(
    (total, peso, indice) => total + peso * Number(digitos[indice]),
    0
  );

  const resto = suma % 11;
  const esperado = resto === 0 ? 0 : 11 - resto;

  // Resto 1 daria un verificador de 10, que no entra en un digito: ese CUIT
  // no existe.
  if (esperado === 10) return false;

  return esperado === Number(digitos[10]);
}

/** Formato de email. Deliberadamente laxo: lo definitivo es que el mail llegue. */
export function esEmail(texto: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(texto.trim());
}

/** Direccion web. Solo http y https: el link se abre desde el sitio y el PDF. */
export function esUrlWeb(texto: string) {
  try {
    const url = new URL(texto.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
