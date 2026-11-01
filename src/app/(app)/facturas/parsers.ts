/**
 * Lector de DTE (documentos tributarios electrónicos del SII).
 *
 * Un XML puede traer un solo <DTE> o venir envuelto en <EnvioDTE> con varios
 * adentro. Los tags van bajo el namespace http://www.sii.cl/SiiDte, y no todos
 * los emisores lo declaran igual, así que la búsqueda es por nombre local y
 * no por namespace: de otro modo un prefijo distinto rompería la lectura.
 */

// RUT de ATS Ingeniería y Proyectos SpA, tomado de la cabecera de la cartola.
// Sirve para saber de qué lado está la empresa: si es el receptor, el
// documento es una compra (gasto); si es el emisor, es una venta.
export const RUT_EMPRESA = "78183895-0";

export type DocumentoSii = {
  rutEmisor: string;
  razonSocial: string | null;
  tipoDte: number;
  folio: number;
  fechaEmision: string; // YYYY-MM-DD
  montoNeto: number;
  montoExento: number;
  iva: number;
  montoTotal: number;
  signo: 1 | -1;
  detalle: string | null;
  nombreTipo: string;
};

const TIPOS: Record<number, string> = {
  33: "Factura electrónica",
  34: "Factura exenta",
  39: "Boleta electrónica",
  41: "Boleta exenta",
  43: "Liquidación factura",
  46: "Factura de compra",
  52: "Guía de despacho",
  56: "Nota de débito",
  61: "Nota de crédito",
  110: "Factura de exportación",
  111: "Nota de débito de exportación",
  112: "Nota de crédito de exportación",
};

// Documentos que no representan un costo: la guía de despacho mueve mercadería
// y se factura aparte, así que registrarla duplicaría el gasto.
const SIN_EFECTO_CONTABLE = new Set([52]);

// Las notas de crédito rebajan o anulan lo facturado.
const NOTAS_DE_CREDITO = new Set([61, 112]);

function hijosPorNombre(raiz: Element | Document, nombre: string): Element[] {
  const objetivo = nombre.toLowerCase();
  const todos = raiz.getElementsByTagName("*");
  const salida: Element[] = [];
  for (let i = 0; i < todos.length; i++) {
    const el = todos[i];
    if ((el.localName || el.nodeName).toLowerCase() === objetivo) salida.push(el);
  }
  return salida;
}

function texto(raiz: Element, nombre: string): string | null {
  const encontrados = hijosPorNombre(raiz, nombre);
  const valor = encontrados[0]?.textContent?.trim();
  return valor ? valor : null;
}

function numero(raiz: Element, nombre: string): number {
  const v = texto(raiz, nombre);
  if (!v) return 0;
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function normalizarRut(rut: string | null): string | null {
  if (!rut) return null;
  const limpio = rut.replace(/[.\s]/g, "").toUpperCase();
  return /^\d{7,9}-[\dK]$/.test(limpio) ? limpio : null;
}

function leerDocumento(nodo: Element): DocumentoSii | { error: string } {
  const tipoDte = Number(texto(nodo, "TipoDTE") ?? 0);
  const folio = Number(texto(nodo, "Folio") ?? 0);
  if (!tipoDte || !folio) return { error: "El documento no trae tipo o folio." };

  const rutEmisor = normalizarRut(texto(nodo, "RUTEmisor"));
  const rutReceptor = normalizarRut(texto(nodo, "RUTRecep"));
  if (!rutEmisor) return { error: `Folio ${folio}: no pude leer el RUT del emisor.` };

  if (rutEmisor === RUT_EMPRESA)
    return {
      error: `Folio ${folio}: lo emitió ATS, es una venta y no un gasto. Se registra desde Ventas.`,
    };
  if (rutReceptor && rutReceptor !== RUT_EMPRESA)
    return {
      error: `Folio ${folio}: está dirigido a ${rutReceptor}, no a ATS (${RUT_EMPRESA}).`,
    };
  if (SIN_EFECTO_CONTABLE.has(tipoDte))
    return {
      error: `Folio ${folio}: es una ${TIPOS[tipoDte] ?? "guía"} y se factura aparte, no es un gasto.`,
    };

  const fecha = texto(nodo, "FchEmis");
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha))
    return { error: `Folio ${folio}: fecha de emisión ausente o ilegible.` };

  // El detalle ayuda a reconocer el gasto cuando la razón social no dice mucho.
  const items = hijosPorNombre(nodo, "NmbItem")
    .map((el) => el.textContent?.trim())
    .filter((t): t is string => Boolean(t));

  return {
    rutEmisor,
    razonSocial: texto(nodo, "RznSoc"),
    tipoDte,
    folio,
    fechaEmision: fecha,
    montoNeto: numero(nodo, "MntNeto"),
    montoExento: numero(nodo, "MntExe"),
    iva: numero(nodo, "IVA"),
    montoTotal: numero(nodo, "MntTotal"),
    signo: NOTAS_DE_CREDITO.has(tipoDte) ? -1 : 1,
    detalle: items.length ? items.slice(0, 5).join(" · ").slice(0, 400) : null,
    nombreTipo: TIPOS[tipoDte] ?? `Documento tipo ${tipoDte}`,
  };
}

export type ResultadoXml = {
  documentos: DocumentoSii[];
  avisos: string[];
};

export async function parseArchivosDte(files: File[]): Promise<ResultadoXml> {
  const documentos: DocumentoSii[] = [];
  const avisos: string[] = [];
  const vistos = new Set<string>();

  for (const file of files) {
    let xml: Document;
    try {
      const texto = await file.text();
      xml = new DOMParser().parseFromString(texto, "application/xml");
    } catch {
      avisos.push(`${file.name}: no se pudo leer el archivo.`);
      continue;
    }

    if (hijosPorNombre(xml, "parsererror").length > 0) {
      avisos.push(`${file.name}: el XML está mal formado.`);
      continue;
    }

    // Un <EnvioDTE> agrupa varios documentos; un archivo suelto trae uno.
    const nodos = hijosPorNombre(xml, "Documento");
    const candidatos = nodos.length > 0 ? nodos : hijosPorNombre(xml, "DTE");
    if (candidatos.length === 0) {
      avisos.push(`${file.name}: no encontré ningún DTE adentro.`);
      continue;
    }

    for (const nodo of candidatos) {
      const leido = leerDocumento(nodo);
      if ("error" in leido) {
        avisos.push(`${file.name} · ${leido.error}`);
        continue;
      }
      const clave = `${leido.rutEmisor}|${leido.tipoDte}|${leido.folio}`;
      if (vistos.has(clave)) continue; // el mismo DTE repetido entre archivos
      vistos.add(clave);
      documentos.push(leido);
    }
  }

  return { documentos, avisos };
}
