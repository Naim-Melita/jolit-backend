import "dotenv/config";

/**
 * Revisa que el envio de mails este realmente funcionando.
 *
 *   npm run email:check
 *   npm run email:check -- --to=vos@gmail.com
 *
 * Existe porque sendEmail nunca lanza: si Resend rechaza un mail, la venta se
 * guarda igual y el error queda solo en los logs del servidor. Sin algo asi,
 * de un dominio mal verificado nos enteramos cuando una clienta reclama que
 * no le llego nada.
 *
 * No imprime la API key.
 */

const RESEND_DOMAINS = "https://api.resend.com/domains";
const RESEND_EMAILS = "https://api.resend.com/emails";

type ResendDomain = {
  name: string;
  status: string;
  region?: string;
};

function readFlag(name: string) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

/** "Jolit <pedidos@jolit.com.ar>" y "pedidos@jolit.com.ar" dan lo mismo. */
function dominioDelRemitente(from: string) {
  const entreAngulos = from.match(/<([^>]+)>/);
  const direccion = (entreAngulos ? entreAngulos[1] : from).trim();
  const arroba = direccion.lastIndexOf("@");

  return arroba === -1 ? "" : direccion.slice(arroba + 1).toLowerCase();
}

/**
 * Pregunta a Resend por el estado del dominio. La API key del servidor suele
 * ser de solo envio, que es lo recomendable: en ese caso este chequeo no se
 * puede hacer y lo resuelve el de DNS, que no necesita permisos.
 */
async function revisarDominioEnResend(
  apiKey: string,
  dominio: string,
  problemas: string[]
) {
  const respuesta = await fetch(RESEND_DOMAINS, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => "");

    if (detalle.includes("restricted_api_key")) {
      console.log("Dominios en Resend");
      console.log("------------------");
      console.log("  no se puede consultar: la API key es de solo envio.");
      console.log("  (esta bien que lo sea; lo verificamos por DNS mas abajo)");
      console.log("");
      return;
    }

    if (respuesta.status === 401) {
      problemas.push("La API key de Resend no es valida o fue rotada.");
    } else {
      problemas.push(
        `Resend respondio ${respuesta.status} al listar dominios: ${detalle}`
      );
    }

    return;
  }

  const { data } = (await respuesta.json()) as { data: ResendDomain[] };
  const dominios = data ?? [];

  console.log("Dominios en Resend");
  console.log("------------------");

  if (dominios.length === 0) {
    console.log("  ninguno");
  } else {
    for (const registro of dominios) {
      const marca = registro.status === "verified" ? "OK  " : "... ";
      console.log(`  ${marca}${registro.name} (${registro.status})`);
    }
  }

  console.log("");

  const propio = dominios.find((registro) => registro.name === dominio);

  if (!propio) {
    problemas.push(
      `El dominio del remitente (${dominio}) no esta dado de alta en Resend.`
    );
  } else if (propio.status !== "verified") {
    problemas.push(
      `El dominio ${dominio} figura en Resend con estado "${propio.status}". Faltan cargar o propagar los registros DNS.`
    );
  }
}

type EstadoDns = "existe" | "falta" | "sin_respuesta";

/**
 * Consulta un TXT por DNS sobre HTTPS en vez de usar node:dns, que resuelve
 * por UDP contra el DNS del sistema y queda colgado en redes que lo bloquean.
 * Ahi devolvia "no existe" para todo, incluso para dominios que si tenian el
 * registro: un diagnostico que miente es peor que no tenerlo.
 *
 * Distingue "no esta" de "no pude preguntar": solo lo primero es un problema.
 */
async function consultarTxt(nombre: string): Promise<EstadoDns> {
  try {
    const respuesta = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(nombre)}&type=TXT`,
      { headers: { accept: "application/dns-json" } }
    );

    if (!respuesta.ok) return "sin_respuesta";

    const datos = (await respuesta.json()) as {
      Status: number;
      Answer?: unknown[];
    };

    // 0 = NOERROR, 3 = NXDOMAIN (el nombre no existe).
    if (datos.Status === 3) return "falta";
    if (datos.Status !== 0) return "sin_respuesta";

    return (datos.Answer?.length ?? 0) > 0 ? "existe" : "falta";
  } catch {
    return "sin_respuesta";
  }
}

/**
 * Revisa que esten publicados los registros que Resend pide para firmar los
 * mails. Sin DKIM, Gmail manda todo a spam o directamente lo rechaza.
 */
async function revisarDnsDelDominio(dominio: string, problemas: string[]) {
  if (dominio === "resend.dev") return;

  console.log("Registros DNS del dominio");
  console.log("-------------------------");

  const dkim = await consultarTxt(`resend._domainkey.${dominio}`);
  const spf = await consultarTxt(`send.${dominio}`);

  const marca = (estado: EstadoDns) =>
    estado === "existe" ? "OK    " : estado === "falta" ? "FALTA " : "?     ";

  console.log(`  ${marca(dkim)}DKIM  resend._domainkey.${dominio}`);
  console.log(`  ${marca(spf)}SPF   send.${dominio}`);

  if (dkim === "sin_respuesta" || spf === "sin_respuesta") {
    console.log("  (no se pudo consultar el DNS; revisar la conexion)");
  }

  console.log("");

  if (dkim === "falta" || spf === "falta") {
    problemas.push(
      `Faltan registros DNS de ${dominio}. Los da Resend al agregar el dominio y se cargan en el panel de DNS. Sin ellos los mails no salen, o caen en spam.`
    );
  }
}

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "";
  const owner = process.env.OWNER_EMAIL ?? "";
  const problemas: string[] = [];

  console.log("");
  console.log("Configuracion de mails");
  console.log("----------------------");
  console.log(`  RESEND_API_KEY   ${apiKey ? "cargada" : "FALTA"}`);
  console.log(`  EMAIL_FROM       ${from || "FALTA"}`);
  console.log(`  OWNER_EMAIL      ${owner || "FALTA (no te llegan los avisos de cobro)"}`);
  console.log("");

  if (!apiKey || !from) {
    console.error(
      "Sin RESEND_API_KEY y EMAIL_FROM no se manda ningun mail. Los pedidos se guardan igual, pero nadie se entera."
    );
    process.exit(1);
  }

  const dominio = dominioDelRemitente(from);

  if (!dominio) {
    console.error(`EMAIL_FROM no tiene una direccion valida: ${from}`);
    process.exit(1);
  }

  if (dominio === "resend.dev") {
    problemas.push(
      "EMAIL_FROM todavia usa el remitente de prueba de Resend (onboarding@resend.dev). Con ese remitente Resend solo entrega a la casilla con la que se creo la cuenta: las clientas NO reciben nada."
    );
  }

  await revisarDominioEnResend(apiKey, dominio, problemas);
  await revisarDnsDelDominio(dominio, problemas);

  const destino = readFlag("to");

  if (destino) {
    console.log(`Mandando un mail de prueba a ${destino}...`);

    const envio = await fetch(RESEND_EMAILS, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [destino],
        subject: "Prueba de envio de Jolit",
        html: "<p>Si estas leyendo esto, el envio de mails de la tienda funciona.</p>",
      }),
    });

    if (envio.ok) {
      console.log("  aceptado por Resend. Revisa la casilla (y el spam).");
    } else {
      const detalle = await envio.text().catch(() => "");
      problemas.push(
        `Resend rechazo el mail de prueba con ${envio.status}: ${detalle}`
      );
    }

    console.log("");
  }

  if (problemas.length > 0) {
    console.log("Problemas");
    console.log("---------");
    for (const problema of problemas) console.log(`  - ${problema}`);
    console.log("");
    process.exit(1);
  }

  console.log("Todo en orden: los mails salen desde " + from);
  console.log("");
}

main().catch((error) => {
  console.error("No se pudo completar la revision", error);
  process.exit(1);
});
