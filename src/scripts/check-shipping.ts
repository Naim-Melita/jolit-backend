import "dotenv/config";
import {
  armarBulto,
  cotizar,
  entornoDeMicorreo,
  masBarata,
  micorreoConfigurado,
  obtenerToken,
} from "../lib/micorreo.js";
import { getStoreSettings } from "../services/settings.service.js";

/**
 * Revisa que la cotizacion contra Correo Argentino este funcionando.
 *
 *   npm run envio:check
 *   npm run envio:check -- --cp=9410
 *
 * Existe por lo mismo que el de los mails: si Correo Argentino rechaza la
 * cotizacion, la venta se cierra igual con la tarifa de la tabla y el error
 * queda solo en los logs. Sin algo asi, de unas credenciales mal cargadas nos
 * enteramos por la diferencia en la facturacion a fin de mes.
 *
 * No imprime las credenciales.
 */

const DESTINOS = [
  ["1425", "CABA"],
  ["1636", "GBA"],
  ["5000", "Cordoba"],
  ["9410", "Ushuaia"],
] as const;

function leerOpcion(nombre: string) {
  const prefijo = `--${nombre}=`;
  const encontrado = process.argv.find((a) => a.startsWith(prefijo));
  return encontrado ? encontrado.slice(prefijo.length) : "";
}

const pesos = (valor: number) =>
  "$" + valor.toLocaleString("es-AR", { maximumFractionDigits: 0 });

async function main() {
  console.log("\nCorreo Argentino\n");
  console.log(`  ${"entorno".padEnd(32)} ${entornoDeMicorreo()}`);

  const faltan = [
    ["CORREO_ARGENTINO_USER_TOKEN", process.env.CORREO_ARGENTINO_USER_TOKEN],
    ["CORREO_ARGENTINO_PASSWORD_TOKEN", process.env.CORREO_ARGENTINO_PASSWORD_TOKEN],
    ["CORREO_ARGENTINO_CUSTOMER_ID", process.env.CORREO_ARGENTINO_CUSTOMER_ID],
  ].filter(([, valor]) => !valor);

  for (const [nombre, valor] of [
    ["CORREO_ARGENTINO_USER_TOKEN", process.env.CORREO_ARGENTINO_USER_TOKEN],
    ["CORREO_ARGENTINO_PASSWORD_TOKEN", process.env.CORREO_ARGENTINO_PASSWORD_TOKEN],
    ["CORREO_ARGENTINO_CUSTOMER_ID", process.env.CORREO_ARGENTINO_CUSTOMER_ID],
  ]) {
    console.log(`  ${String(nombre).padEnd(32)} ${valor ? "cargado" : "VACIO"}`);
  }

  const settings = await getStoreSettings();
  const origen = (settings.shipping.originPostalCode ?? "").trim();

  console.log(`  ${"codigo postal de origen".padEnd(32)} ${origen || "VACIO"}`);
  console.log(
    `  ${"paquete".padEnd(32)} ${settings.shipping.gramsPerItem} g por pieza, ` +
      `${settings.shipping.packageHeight}x${settings.shipping.packageWidth}x${settings.shipping.packageLength} cm\n`
  );

  if (!micorreoConfigurado() || faltan.length > 0) {
    console.log(
      "Faltan credenciales. Mientras tanto la tienda cotiza con la tabla de\n" +
        "zonas del panel, que es una estimacion.\n\n" +
        "Las credenciales las da un ejecutivo de cuentas de Correo Argentino:\n" +
        "no hay registro publico.\n"
    );
    process.exit(1);
  }

  if (!origen) {
    console.log(
      "Falta el codigo postal de origen. Se carga en el panel, pestaña Tienda.\n" +
        "Sin eso no se puede cotizar: la API necesita las dos puntas.\n"
    );
    process.exit(1);
  }

  try {
    await obtenerToken(true);
    console.log("  token                   obtenido\n");
  } catch (error) {
    console.log(
      "\nNo se pudo obtener el token:\n  " +
        (error instanceof Error ? error.message : String(error)) +
        "\n\nRevisa que las credenciales sean las del entorno correcto: las de\n" +
        "prueba no sirven en produccion ni al reves.\n"
    );
    process.exit(1);
  }

  const soloUno = leerOpcion("cp");
  const destinos = soloUno ? ([[soloUno, "elegido"]] as const) : DESTINOS;
  const bulto = armarBulto(2, {
    gramosPorPieza: settings.shipping.gramsPerItem,
    alto: settings.shipping.packageHeight,
    ancho: settings.shipping.packageWidth,
    largo: settings.shipping.packageLength,
  });

  console.log(`Cotizaciones reales para 2 piezas (${bulto.weight} g):\n`);
  console.log("  destino            real        tabla");

  const porZona: Record<string, number> = {
    "1425": settings.shipping.cabaRate,
    "1636": settings.shipping.gbaRate,
    "5000": settings.shipping.interiorRate,
    "9410": settings.shipping.patagoniaRate,
  };

  let fallaron = 0;

  for (const [cp, etiqueta] of destinos) {
    try {
      const tarifas = await cotizar({
        postalCodeOrigin: origen,
        postalCodeDestination: cp,
        deliveredType: "D",
        dimensions: bulto,
      });

      const mejor = masBarata(tarifas, "D");

      if (!mejor) {
        console.log(`  ${(etiqueta + " " + cp).padEnd(18)} sin tarifas`);
        fallaron += 1;
        continue;
      }

      const tabla = porZona[cp];
      const comparacion = tabla ? pesos(tabla) : "";
      console.log(
        `  ${(etiqueta + " " + cp).padEnd(18)} ${pesos(mejor.price).padEnd(11)} ${comparacion}`
      );
    } catch (error) {
      console.log(
        `  ${(etiqueta + " " + cp).padEnd(18)} ERROR: ` +
          (error instanceof Error ? error.message : String(error))
      );
      fallaron += 1;
    }
  }

  if (fallaron > 0) {
    console.log("\nAlguna cotizacion fallo. La tienda sigue vendiendo con la tabla.\n");
    process.exit(1);
  }

  console.log(
    "\nTodo en orden: la tienda esta cotizando con precios reales.\n\n" +
      "Si alguna columna 'tabla' quedo muy abajo de la real, conviene subirla:\n" +
      "es lo que se cobra cuando Correo Argentino no contesta.\n"
  );
}

main().catch((error) => {
  console.error("\nNo se pudo completar el chequeo:", error);
  process.exitCode = 1;
});
