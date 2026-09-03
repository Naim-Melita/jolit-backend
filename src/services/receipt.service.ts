import PDFDocument from "pdfkit";
import type { Order, StoreSettings } from "../types.js";

const PINK = "#db2777";
const INK = "#111827";
const MUTED = "#6b7280";
const HAIRLINE = "#e5e7eb";

const MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4 en puntos
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Columnas de la tabla de items, medidas desde el margen izquierdo.
const COL_QTY = MARGIN + 250;
const COL_UNIT = MARGIN + 310;
const COL_TOTAL = MARGIN + 400;
const COL_TOTAL_WIDTH = CONTENT_WIDTH - 400;

const money = (value: string | number) =>
  `$${Number(value).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

/**
 * Comprobante de pedido en PDF. NO es un comprobante fiscal: no lleva CAE ni
 * pasa por ARCA, y el documento lo aclara. Si mas adelante se emite Factura C,
 * va como otro generador con esta misma firma, sin tocar el flujo de mails.
 */
export function buildOrderReceiptPdf(
  order: Order,
  settings: StoreSettings
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: MARGIN });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      renderReceipt(doc, order, settings);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function renderReceipt(
  doc: PDFKit.PDFDocument,
  order: Order,
  settings: StoreSettings
) {
  const seller = settings.seller;

  // --- Encabezado -----------------------------------------------------------
  doc
    .fillColor(PINK)
    .fontSize(24)
    .font("Helvetica-Bold")
    .text(settings.storeName || "Jolit", MARGIN, MARGIN);

  const sellerLines = [
    seller.legalName,
    seller.taxId ? `CUIT ${seller.taxId}` : "",
    seller.address,
    seller.email,
  ].filter(Boolean);

  doc.fontSize(9).font("Helvetica").fillColor(MUTED);
  doc.text(sellerLines.join("\n"), MARGIN + 260, MARGIN + 2, {
    width: CONTENT_WIDTH - 260,
    align: "right",
  });

  const headerBottom = Math.max(doc.y, MARGIN + 60);

  doc
    .moveTo(MARGIN, headerBottom + 8)
    .lineTo(PAGE_WIDTH - MARGIN, headerBottom + 8)
    .strokeColor(HAIRLINE)
    .stroke();

  // --- Titulo ---------------------------------------------------------------
  doc
    .fillColor(INK)
    .fontSize(15)
    .font("Helvetica-Bold")
    .text("COMPROBANTE DE PEDIDO", MARGIN, headerBottom + 24);

  doc
    .fontSize(11)
    .font("Helvetica")
    .fillColor(MUTED)
    .text(
      `N.o ${order.orderNumber}   ·   Emitido el ${formatDate(new Date())}`,
      MARGIN,
      doc.y + 4
    );

  // --- Cliente y entrega ----------------------------------------------------
  const blockTop = doc.y + 20;

  block(doc, "CLIENTE", MARGIN, blockTop, CONTENT_WIDTH / 2 - 10, [
    order.customerName,
    order.customerEmail,
    order.customerPhone,
  ]);

  block(
    doc,
    "ENTREGA",
    MARGIN + CONTENT_WIDTH / 2 + 10,
    blockTop,
    CONTENT_WIDTH / 2 - 10,
    [
      order.shippingAddress || "-",
      [order.shippingCity, order.shippingPostalCode].filter(Boolean).join(" "),
      `${order.shippingProvider} ${order.shippingService}`,
      order.shippingEta,
    ].filter(Boolean)
  );

  // --- Tabla de items -------------------------------------------------------
  let y = Math.max(doc.y, blockTop + 80) + 20;

  doc.fontSize(8).font("Helvetica-Bold").fillColor(MUTED);
  doc.text("DETALLE", MARGIN, y);
  doc.text("CANT.", COL_QTY, y);
  doc.text("UNITARIO", COL_UNIT, y);
  doc.text("IMPORTE", COL_TOTAL, y, {
    width: COL_TOTAL_WIDTH,
    align: "right",
  });

  y += 14;
  doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).strokeColor(HAIRLINE).stroke();
  y += 10;

  doc.fontSize(10).font("Helvetica").fillColor(INK);

  for (const item of order.items) {
    doc.text(item.name, MARGIN, y, { width: 240 });
    const rowHeight = Math.max(doc.y - y, 12);

    doc.text(`x${item.quantity}`, COL_QTY, y);
    doc.text(money(item.price), COL_UNIT, y);
    doc.text(money(item.subtotal), COL_TOTAL, y, {
      width: COL_TOTAL_WIDTH,
      align: "right",
    });

    y += rowHeight + 8;
  }

  // --- Totales --------------------------------------------------------------
  doc.moveTo(COL_UNIT, y).lineTo(PAGE_WIDTH - MARGIN, y).strokeColor(HAIRLINE).stroke();
  y += 10;

  const shippingLabel =
    Number(order.shippingCost) === 0 ? "Gratis" : money(order.shippingCost);

  y = totalRow(doc, "Subtotal", money(order.subtotalAmount), y, false);
  y = totalRow(doc, "Envio", shippingLabel, y, false);
  y = totalRow(doc, "TOTAL", money(order.totalAmount), y + 4, true);

  // --- Pie ------------------------------------------------------------------
  const footerTop = y + 34;

  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .fillColor(INK)
    .text(`Pago recibido el ${formatDate(new Date())}.`, MARGIN, footerTop);

  doc
    .fontSize(8)
    .font("Helvetica")
    .fillColor(MUTED)
    .text(
      "Este documento no es una factura electronica y no reemplaza el comprobante " +
        "fiscal correspondiente. Se emite unicamente como constancia del pedido y " +
        "del pago recibido.",
      MARGIN,
      doc.y + 8,
      { width: CONTENT_WIDTH }
    );

  if (seller.dataFiscalUrl) {
    doc.text(`Data Fiscal: ${seller.dataFiscalUrl}`, MARGIN, doc.y + 6, {
      width: CONTENT_WIDTH,
    });
  }
}

function block(
  doc: PDFKit.PDFDocument,
  title: string,
  x: number,
  y: number,
  width: number,
  lines: string[]
) {
  doc.fontSize(8).font("Helvetica-Bold").fillColor(MUTED).text(title, x, y);
  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor(INK)
    .text(lines.join("\n"), x, y + 13, { width });
}

function totalRow(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  y: number,
  emphasis: boolean
) {
  doc
    .fontSize(emphasis ? 13 : 10)
    .font(emphasis ? "Helvetica-Bold" : "Helvetica")
    .fillColor(emphasis ? INK : MUTED)
    .text(label, COL_UNIT, y);

  doc
    .fillColor(emphasis ? PINK : INK)
    .text(value, COL_TOTAL, y, { width: COL_TOTAL_WIDTH, align: "right" });

  return y + (emphasis ? 22 : 16);
}

export function receiptFileName(order: Order) {
  return `comprobante-${order.orderNumber}.pdf`;
}
