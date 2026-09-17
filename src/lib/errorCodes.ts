/**
 * Codigos de error de la API.
 *
 * El mensaje es para que lo lea una persona y puede cambiar cuando queramos;
 * el codigo es el contrato. Antes no existia y el panel terminaba decidiendo
 * por el texto del mensaje: "Clerk authentication is not configured" (un 503,
 * o sea un problema de configuracion del servidor) contenia la palabra
 * "authentication" y deslogueaba a la duenia como si se hubiera equivocado de
 * contrasenia.
 */
export const CODIGOS = {
  // Catalogo y compra
  STOCK_INSUFICIENTE: "STOCK_INSUFICIENTE",
  PRODUCTO_NO_ENCONTRADO: "PRODUCTO_NO_ENCONTRADO",
  PRODUCTO_SIN_PRECIO: "PRODUCTO_SIN_PRECIO",
  PEDIDO_NO_ENCONTRADO: "PEDIDO_NO_ENCONTRADO",
  PEDIDO_NO_PENDIENTE: "PEDIDO_NO_PENDIENTE",
  CANTIDAD_INVALIDA: "CANTIDAD_INVALIDA",
  ITEM_NO_EN_CARRITO: "ITEM_NO_EN_CARRITO",
  CODIGO_POSTAL_INVALIDO: "CODIGO_POSTAL_INVALIDO",
  PERFIL_REQUERIDO: "PERFIL_REQUERIDO",

  // Pagos
  PAGOS_NO_DISPONIBLES: "PAGOS_NO_DISPONIBLES",
  PAGO_SIN_LINK: "PAGO_SIN_LINK",
  PAGO_RECHAZADO_POR_PASARELA: "PAGO_RECHAZADO_POR_PASARELA",

  // Sesion y permisos
  SESION_REQUERIDA: "SESION_REQUERIDA",
  ADMIN_AUTH_REQUERIDA: "ADMIN_AUTH_REQUERIDA",
  CREDENCIALES_INVALIDAS: "CREDENCIALES_INVALIDAS",
  PASSWORD_ACTUAL_INVALIDA: "PASSWORD_ACTUAL_INVALIDA",
  SIN_PERMISOS: "SIN_PERMISOS",

  // Configuracion del servidor: NO son culpa de quien esta usando la tienda
  CLERK_NO_CONFIGURADO: "CLERK_NO_CONFIGURADO",
  WEBHOOK_NO_CONFIGURADO: "WEBHOOK_NO_CONFIGURADO",

  // Panel
  CATEGORIA_NO_ENCONTRADA: "CATEGORIA_NO_ENCONTRADA",
  CATEGORIA_CON_PRODUCTOS: "CATEGORIA_CON_PRODUCTOS",
  SLUG_DUPLICADO: "SLUG_DUPLICADO",
  IMAGEN_REQUERIDA: "IMAGEN_REQUERIDA",
  IMAGEN_INVALIDA: "IMAGEN_INVALIDA",
  SUBIDA_FALLIDA: "SUBIDA_FALLIDA",

  // Genericos por estado HTTP
  SOLICITUD_INVALIDA: "SOLICITUD_INVALIDA",
  VALIDACION: "VALIDACION",
  NO_AUTENTICADO: "NO_AUTENTICADO",
  NO_ENCONTRADO: "NO_ENCONTRADO",
  CONFLICTO: "CONFLICTO",
  SERVICIO_EXTERNO: "SERVICIO_EXTERNO",
  SERVICIO_NO_DISPONIBLE: "SERVICIO_NO_DISPONIBLE",
  ERROR_INTERNO: "ERROR_INTERNO",
  RUTA_NO_ENCONTRADA: "RUTA_NO_ENCONTRADA",
} as const;

export type CodigoDeError = (typeof CODIGOS)[keyof typeof CODIGOS];

/** Para los errores que todavia no tienen un codigo propio. */
export function codigoPorDefecto(status: number): CodigoDeError {
  switch (status) {
    case 400:
      return CODIGOS.SOLICITUD_INVALIDA;
    case 401:
      return CODIGOS.NO_AUTENTICADO;
    case 403:
      return CODIGOS.SIN_PERMISOS;
    case 404:
      return CODIGOS.NO_ENCONTRADO;
    case 409:
      return CODIGOS.CONFLICTO;
    case 422:
      return CODIGOS.VALIDACION;
    case 502:
      return CODIGOS.SERVICIO_EXTERNO;
    case 503:
      return CODIGOS.SERVICIO_NO_DISPONIBLE;
    default:
      return CODIGOS.ERROR_INTERNO;
  }
}
