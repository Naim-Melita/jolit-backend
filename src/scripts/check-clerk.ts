import "dotenv/config";
import { instanciaDeClerk } from "../lib/clerkEntorno.js";
import { conYSinWww, origenesConfigurados } from "../lib/origenes.js";

/**
 * Dice con que instancia de Clerk esta corriendo la tienda.
 *
 *   npm run clerk:check
 *
 * Sirve para dos cosas: enterarse de que la tienda publicada quedo con las
 * claves de prueba, y confirmar que el cambio a produccion tomo. Las claves
 * nunca se imprimen enteras, solo el prefijo.
 */

const etiqueta = (valor: string) => valor.padEnd(22);

function mostrar(nombre: string, clave: string | undefined) {
  const instancia = instanciaDeClerk(clave);
  const prefijo = clave?.trim().slice(0, 8) ?? "";

  console.log(
    `  ${etiqueta(nombre)} ${instancia.padEnd(16)} ${prefijo ? prefijo + "..." : "(vacia)"}`
  );

  return instancia;
}

console.log("\nClerk\n");

const publica = mostrar("CLERK_PUBLISHABLE_KEY", process.env.CLERK_PUBLISHABLE_KEY);
const secreta = mostrar("CLERK_SECRET_KEY", process.env.CLERK_SECRET_KEY);
const webhook = process.env.CLERK_WEBHOOK_SECRET?.trim();

console.log(
  `  ${etiqueta("CLERK_WEBHOOK_SECRET")} ${webhook ? "cargado" : "vacio (opcional)"}`
);

const sitios = [...conYSinWww(origenesConfigurados())];
console.log(`\nSitios autorizados a usar la sesión (authorizedParties):`);
if (sitios.length === 0) {
  console.log("  (ninguno: falta FRONTEND_ORIGIN)");
} else {
  sitios.forEach((sitio) => console.log(`  ${sitio}`));
}

console.log("");

if (publica !== secreta) {
  console.log(
    "PROBLEMA: la clave pública y la secreta no son de la misma instancia.\n" +
      "Las sesiones que emita una no las va a validar la otra.\n"
  );
  process.exit(1);
}

if (secreta === "sin configurar") {
  console.log("Clerk no esta configurado: las cuentas de clientas no funcionan.\n");
  process.exit(1);
}

if (secreta === "desarrollo") {
  console.log(
    "Esta corriendo con la instancia de DESARROLLO.\n\n" +
      "Esta bien mientras se trabaja. En la tienda publicada no: tiene topes de\n" +
      "uso, usa credenciales de OAuth compartidas y manda los correos desde el\n" +
      "dominio de Clerk.\n"
  );
  process.exit(process.env.NODE_ENV === "production" ? 1 : 0);
}

console.log("Todo en orden: instancia de producción.\n");
