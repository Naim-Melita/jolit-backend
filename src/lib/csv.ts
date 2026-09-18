/**
 * Lector de CSV.
 *
 * Existe porque el proyecto no tiene una libreria para esto y las
 * descripciones de los productos van a tener comas, comillas y saltos de
 * linea. Un split(",") las parte al medio y arruina la carga.
 *
 * Soporta lo que sale de Excel, Google Sheets y LibreOffice:
 * campos entre comillas, comas adentro de las comillas, comillas escapadas
 * duplicandolas ("") y saltos de linea dentro de un campo.
 */

/** Separa una linea logica en campos. */
function partirFila(texto: string, desde: number, separador: string) {
  const campos: string[] = [];
  let campo = "";
  let i = desde;
  let entreComillas = false;

  while (i < texto.length) {
    const c = texto[i];

    if (entreComillas) {
      if (c === '"') {
        // Dos comillas seguidas son una comilla literal.
        if (texto[i + 1] === '"') {
          campo += '"';
          i += 2;
          continue;
        }
        entreComillas = false;
        i += 1;
        continue;
      }

      campo += c;
      i += 1;
      continue;
    }

    if (c === '"') {
      entreComillas = true;
      i += 1;
      continue;
    }

    if (c === separador) {
      campos.push(campo);
      campo = "";
      i += 1;
      continue;
    }

    if (c === "\r") {
      i += 1;
      continue;
    }

    if (c === "\n") {
      i += 1;
      break;
    }

    campo += c;
    i += 1;
  }

  campos.push(campo);

  return { campos, siguiente: i };
}

/**
 * Convierte el contenido de un CSV en una lista de objetos, usando la primera
 * fila como nombres de columna.
 *
 * Detecta solo si el separador es coma o punto y coma: Excel en castellano
 * guarda con punto y coma y es el error mas comun al exportar.
 */
export function leerCsv(contenido: string): Array<Record<string, string>> {
  // Excel a veces antepone una marca invisible al principio del archivo.
  const texto = contenido.replace(/^﻿/, "");

  if (!texto.trim()) return [];

  const primeraLinea = texto.split(/\r?\n/)[0] ?? "";
  const separador =
    (primeraLinea.match(/;/g) || []).length >
    (primeraLinea.match(/,/g) || []).length
      ? ";"
      : ",";

  const filas: string[][] = [];
  let posicion = 0;

  while (posicion < texto.length) {
    const { campos, siguiente } = partirFila(texto, posicion, separador);

    // Una fila con un solo campo vacio es una linea en blanco.
    if (!(campos.length === 1 && campos[0].trim() === "")) {
      filas.push(campos);
    }

    if (siguiente === posicion) break;
    posicion = siguiente;
  }

  if (filas.length === 0) return [];

  const columnas = filas[0].map((c) => c.trim().toLowerCase());

  return filas.slice(1).map((fila) => {
    const registro: Record<string, string> = {};

    columnas.forEach((columna, indice) => {
      registro[columna] = (fila[indice] ?? "").trim();
    });

    return registro;
  });
}
