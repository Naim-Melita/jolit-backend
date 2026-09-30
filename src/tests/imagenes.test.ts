import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fotoDeAncho } from "../lib/imagenes.js";

const FOTO =
  "https://res.cloudinary.com/dmcapdwie/image/upload/v1790729895/jolit/products/1790729895508-aros.jpg";

// Las fotos se guardan tal cual se suben. Una de 1792x2400 y 2,2 MB se
// mandaba entera para mostrarla en una miniatura de 56px del correo.
describe("fotoDeAncho", () => {
  it("pide el ancho que hace falta, sin agrandar", () => {
    assert.equal(
      fotoDeAncho(FOTO, 112),
      "https://res.cloudinary.com/dmcapdwie/image/upload/f_auto,q_auto,w_112,c_limit/v1790729895/jolit/products/1790729895508-aros.jpg"
    );
  });

  it("redondea el ancho: Cloudinary no acepta decimales", () => {
    assert.match(fotoDeAncho(FOTO, 112.4), /w_112,/);
  });

  it("deja igual lo que no es de Cloudinary", () => {
    for (const url of [
      "https://images.unsplash.com/photo-1535632066927",
      "https://jolit.com.ar/logo.png",
      "",
    ]) {
      assert.equal(fotoDeAncho(url, 112), url);
    }
  });

  // Encadenar transformaciones sobre una que ya venia da un resultado
  // dificil de predecir, asi que en ese caso no se toca.
  it("no encadena sobre un enlace que ya trae transformaciones", () => {
    const yaTransformada =
      "https://res.cloudinary.com/dmcapdwie/image/upload/w_500/v1790729895/jolit/products/aros.jpg";

    assert.equal(fotoDeAncho(yaTransformada, 112), yaTransformada);
  });
});
