/**
 * Pedirle a Cloudinary la foto del tamaño que hace falta.
 *
 * En los correos la miniatura mide 56px, pero se mandaba el enlace de la foto
 * original: el cliente de correo se baja los 2 MB para mostrarlos en un
 * cuadradito. Con un pedido de varias piezas son varios megas por correo, y
 * muchos clientes directamente dejan de cargar las imagenes.
 *
 * Cloudinary recorta y convierte a partir del enlace, asi que alcanza con
 * pedirle otra medida. Vale tambien para las fotos que ya estaban subidas.
 *
 * Esto existe tambien del lado de la tienda (client/src/lib/imagenes.ts). Se
 * repite a proposito: son dos repositorios distintos y no comparten codigo.
 */

const CLOUDINARY = "/image/upload/";

/**
 * El enlace de la foto a lo sumo de `ancho` pixeles de ancho.
 *
 * `f_auto` manda WebP donde se entienda, `q_auto` elige la calidad y
 * `c_limit` achica si es mas grande pero nunca la agranda. Las fotos que no
 * son de Cloudinary se devuelven tal cual.
 */
export function fotoDeAncho(url: string, ancho: number) {
  const corte = url.indexOf(CLOUDINARY);
  if (corte === -1) return url;

  const antes = url.slice(0, corte + CLOUDINARY.length);
  const despues = url.slice(corte + CLOUDINARY.length);

  // Si ya trae transformaciones se deja como esta: encadenar otra encima
  // daria un resultado dificil de predecir.
  if (/^[a-z]_[^/]*\//.test(despues)) return url;

  return `${antes}f_auto,q_auto,w_${Math.round(ancho)},c_limit/${despues}`;
}

/** La miniatura del correo mide 56px; se pide al doble por las pantallas retina. */
export const ANCHO_MINIATURA_CORREO = 112;
