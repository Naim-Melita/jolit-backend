import "dotenv/config";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Copia de seguridad de la base, a un archivo.
 *
 *   npm run respaldo
 *
 * Correr esto ANTES de cada despliegue. Las migraciones estan pensadas para
 * no perder nada, pero una copia es lo unico que convierte "no deberia pasar"
 * en "si pasa, se vuelve atras".
 *
 * Lo que NO entra aca, porque no vive en la base:
 *
 *   - Las fotos, que estan en Cloudinary.
 *   - El .env, que no se versiona y hay que guardarlo aparte.
 *
 * Para volver atras, con la base parada y sin nadie escribiendo:
 *
 *   psql "$DATABASE_URL" < respaldos/jolit-AAAA-MM-DD-HHMM.sql
 *
 * Eso borra y rehace las tablas tal como estaban. Si el respaldo es viejo,
 * se pierde lo cargado entre medio: conviene mirar la fecha del archivo antes.
 */

const CARPETA = "respaldos";

function main() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    console.error("\nFalta DATABASE_URL en el .env.\n");
    process.exit(1);
  }

  if (!existsSync(CARPETA)) mkdirSync(CARPETA, { recursive: true });

  const ahora = new Date();
  const sello = [
    ahora.getFullYear(),
    String(ahora.getMonth() + 1).padStart(2, "0"),
    String(ahora.getDate()).padStart(2, "0"),
    String(ahora.getHours()).padStart(2, "0") + String(ahora.getMinutes()).padStart(2, "0"),
  ].join("-");

  const destino = path.join(CARPETA, `jolit-${sello}.sql`);

  console.log(`\nGuardando en ${destino} ...`);

  try {
    // --clean + --if-exists para que el archivo se pueda volver a aplicar
    // sobre una base que ya tiene tablas, que es el caso al restaurar.
    execFileSync(
      "pg_dump",
      ["--clean", "--if-exists", "--no-owner", "--no-privileges", "--file", destino, url],
      { stdio: ["ignore", "inherit", "inherit"] }
    );
  } catch {
    console.error(
      "\nNo se pudo hacer el respaldo.\n\n" +
        "Lo mas comun es que falte pg_dump. En el servidor se instala con:\n" +
        "  sudo apt install postgresql-client\n"
    );
    process.exit(1);
  }

  const bytes = statSync(destino).size;

  // Un archivo de unos pocos bytes significa que pg_dump corrio pero no trajo
  // nada: es peor que no tener respaldo, porque parece que si.
  if (bytes < 1024) {
    console.error(
      `\nEl respaldo quedo en ${bytes} bytes, que es sospechosamente poco.\n` +
        "Revisa que DATABASE_URL apunte a la base correcta.\n"
    );
    process.exit(1);
  }

  console.log(`\nListo: ${(bytes / 1024).toFixed(0)} KB\n`);
  console.log("Para volver atras con este archivo:\n");
  console.log(`  psql "$DATABASE_URL" < ${destino}\n`);
}

main();
