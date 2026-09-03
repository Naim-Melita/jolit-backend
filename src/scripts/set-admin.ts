import "dotenv/config";
import { randomBytes } from "node:crypto";
import { hashPassword } from "../lib/adminAuth.js";
import { prisma } from "../lib/prisma.js";

/**
 * Crea o actualiza la cuenta de admin.
 *
 *   npm run admin:set -- --email=vos@tudominio.com
 *   npm run admin:set -- --email=vos@tudominio.com --password="una larga"
 *
 * Si no se pasa contraseña, genera una fuerte y la imprime una sola vez.
 */

function readFlag(name: string) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

function generatePassword() {
  // 24 caracteres base64url: suficiente para no preocuparse nunca mas.
  return randomBytes(18).toString("base64url");
}

function validate(email: string, password: string) {
  const problems: string[] = [];

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    problems.push("El email no es valido.");
  }

  if (password.length < 12) {
    problems.push("La contraseña debe tener al menos 12 caracteres.");
  }

  if (password === "admin123") {
    problems.push("Esa es la contraseña de ejemplo. Usa otra.");
  }

  return problems;
}

async function main() {
  const email = (readFlag("email") || process.env.ADMIN_SET_EMAIL || "").trim();
  const providedPassword =
    readFlag("password") || process.env.ADMIN_SET_PASSWORD || "";
  const generated = !providedPassword;
  const password = providedPassword || generatePassword();

  if (!email) {
    console.error("Falta el email. Uso:");
    console.error('  npm run admin:set -- --email=vos@tudominio.com');
    process.exitCode = 1;
    return;
  }

  const problems = validate(email, password);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`- ${problem}`);
    process.exitCode = 1;
    return;
  }

  const { hash, salt } = hashPassword(password);
  const existing = await prisma.adminAccount.findFirst({
    orderBy: { id: "asc" },
  });

  const admin = existing
    ? await prisma.adminAccount.update({
        where: { id: existing.id },
        data: { email, passwordHash: hash, passwordSalt: salt },
      })
    : await prisma.adminAccount.create({
        data: { name: "Admin", email, passwordHash: hash, passwordSalt: salt },
      });

  console.log(`${existing ? "Actualizada" : "Creada"} la cuenta de admin.`);
  console.log(`  Email: ${admin.email}`);

  if (generated) {
    console.log(`  Contraseña: ${password}`);
    console.log("");
    console.log("Guardala ahora en tu gestor de contraseñas.");
    console.log("No se vuelve a mostrar: solo queda el hash en la base.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
