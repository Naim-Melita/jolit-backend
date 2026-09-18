/**
 * Convierte un precio escrito a mano en un numero.
 *
 * Excel y Google Sheets en castellano exportan "27.999,99": el punto separa
 * miles y la coma decimales, al reves que en ingles. Leerlo mal no da error,
 * da una joya cargada a 27 pesos, asi que conviene ser explicito.
 *
 * Reglas:
 *   "27999.99"    -> 27999.99   (punto decimal, como en ingles)
 *   "27999,99"    -> 27999.99   (coma decimal, castellano)
 *   "27.999,99"   -> 27999.99   (punto miles + coma decimal)
 *   "27,999.99"   -> 27999.99   (coma miles + punto decimal)
 *   "$ 27.999"    -> 27999      (se ignoran simbolos y espacios)
 *
 * El caso ambiguo es "27,999": puede ser veintisiete mil o veintisiete con
 * noventa y nueve centesimos. Se toma como MILES, que es lo que casi siempre
 * quiere decir en un precio de joyeria. Por eso el importador muestra el
 * precio interpretado antes de escribir nada.
 */
export function leerPrecio(texto: string): number | null {
  const limpio = String(texto)
    .replace(/[^0-9.,-]/g, "")
    .trim();

  if (!limpio) return null;

  const tienePunto = limpio.includes(".");
  const tieneComa = limpio.includes(",");

  let normalizado = limpio;

  if (tienePunto && tieneComa) {
    // El ultimo separador que aparece es el decimal.
    const decimal = limpio.lastIndexOf(".") > limpio.lastIndexOf(",") ? "." : ",";
    const miles = decimal === "." ? "," : ".";

    normalizado = limpio.split(miles).join("").replace(decimal, ".");
  } else if (tieneComa) {
    const despues = limpio.split(",").pop() ?? "";
    // Tres digitos despues de la coma y sin otra coma: son miles.
    normalizado =
      despues.length === 3 && limpio.split(",").length === 2
        ? limpio.replace(",", "")
        : limpio.replace(",", ".");
  } else if (tienePunto) {
    const despues = limpio.split(".").pop() ?? "";
    normalizado =
      despues.length === 3 && limpio.split(".").length === 2
        ? limpio.replace(".", "")
        : limpio;
  }

  const numero = Number(normalizado);

  return Number.isFinite(numero) ? numero : null;
}
