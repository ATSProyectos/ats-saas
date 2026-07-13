import * as XLSX from "xlsx";

export type NormalizedPeaje = {
  fecha: string; // YYYY-MM-DD
  hora: string | null;
  concesionaria: string;
  patente: string | null;
  descripcion: string | null;
  monto: number;
  documento: string; // clave única sintética para no duplicar al re-importar
};

// --- Utilidades de parsing --------------------------------------------------

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

function normalizeHeaderKey(k: string): string {
  return k
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function toNormalizedRow(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) out[normalizeHeaderKey(k)] = v;
  return out;
}

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function parseMoney(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  let s = String(v).trim().replace(/^\$\s?/, "");
  if (s === "") return 0;
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isNaN(n) ? 0 : n;
}

function parseDateOnly(v: unknown, fmt: "dmy" | "ymd" = "dmy"): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = str(v);
  if (!s) return null;
  if (fmt === "ymd") {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

function parseTimeOnly(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(11, 19);
  const s = str(v);
  const m = s.match(/(\d{1,2}):(\d{2})(:(\d{2}))?/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}:${m[4] ?? "00"}`;
}

function splitFechaHoraDMY(v: unknown): { fecha: string | null; hora: string | null } {
  if (v instanceof Date)
    return { fecha: v.toISOString().slice(0, 10), hora: v.toISOString().slice(11, 19) };
  const s = str(v);
  const m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})(:(\d{2}))?/);
  if (!m) return { fecha: null, hora: null };
  return {
    fecha: `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`,
    hora: `${m[4].padStart(2, "0")}:${m[5]}:${m[7] ?? "00"}`,
  };
}

function splitFechaHoraYMD(v: unknown): { fecha: string | null; hora: string | null } {
  if (v instanceof Date)
    return { fecha: v.toISOString().slice(0, 10), hora: v.toISOString().slice(11, 19) };
  const s = str(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(:(\d{2}))?/);
  if (!m) return { fecha: null, hora: null };
  return {
    fecha: `${m[1]}-${m[2]}-${m[3]}`,
    hora: `${m[4].padStart(2, "0")}:${m[5]}:${m[7] ?? "00"}`,
  };
}

// --- Formatos conocidos ------------------------------------------------------
// Cada formato se identifica por un conjunto de columnas (normalizadas) que
// debe tener (`required`) y opcionalmente columnas que NO debe tener
// (`mustNotHave`), para no confundirse con un formato similar.

type FormatSpec = {
  key: string;
  concesionariaDefault: string;
  required: string[];
  mustNotHave?: string[];
  normalize: (row: Record<string, unknown>) => NormalizedPeaje | null;
};

const FORMATS: FormatSpec[] = [
  {
    // avo-detalle-viajes-*.xlsx
    key: "avo_detalle_viajes",
    concesionariaDefault: "Vespucio Oriente (AVO)",
    required: [
      "patente", "fechaentrada", "porticoentrada", "fechasalida",
      "porticosalida", "categoria", "tarifa", "tipotarifa", "estado", "boleta",
    ],
    normalize(row) {
      const { fecha, hora } = splitFechaHoraYMD(row.fechaentrada);
      if (!fecha) return null;
      return {
        fecha, hora,
        concesionaria: "Vespucio Oriente (AVO)",
        patente: str(row.patente) || null,
        descripcion: `${str(row.porticoentrada)} → ${str(row.porticosalida)} (${str(row.categoria)})`,
        monto: parseMoney(row.tarifa),
        documento: `${str(row.boleta)}|${str(row.fechaentrada)}|${str(row.porticoentrada)}`,
      };
    },
  },
  {
    // detalle_consumos_avn*.xlsx
    key: "avn_detalle_consumos",
    concesionariaDefault: "Vespucio Norte (AVN)",
    required: ["patente", "fecha", "hora", "sentido", "portico", "tipodia", "concesionaria", "tipotarifa", "valor"],
    normalize(row) {
      const fecha = parseDateOnly(row.fecha, "dmy");
      if (!fecha) return null;
      return {
        fecha,
        hora: parseTimeOnly(row.hora),
        concesionaria: "Vespucio Norte (AVN)",
        patente: str(row.patente) || null,
        descripcion: `Pórtico ${str(row.portico)} (${str(row.sentido)}, ${str(row.tipotarifa)})`,
        monto: parseMoney(row.valor),
        documento: `${str(row.fecha)}|${str(row.hora)}|${str(row.portico)}|${str(row.patente)}`,
      };
    },
  },
  {
    // transitos_*.xls (Rancagua/Angostura/Paine → Ruta 5 Sur)
    key: "transitos_maipo",
    concesionariaDefault: "Autopista del Maipo (Ruta 5 Sur)",
    required: [
      "fechahora", "plaza", "puntocobro", "via", "sentido", "patente",
      "patentecategoria", "categoriadescripcion", "monto", "tipovehiculo", "numerocomprobantefiscal",
    ],
    normalize(row) {
      const { fecha, hora } = splitFechaHoraDMY(row.fechahora);
      if (!fecha) return null;
      return {
        fecha, hora,
        concesionaria: "Autopista del Maipo (Ruta 5 Sur)",
        patente: str(row.patente) || null,
        descripcion: `${str(row.plaza)} (${str(row.sentido)})`,
        monto: parseMoney(row.monto),
        documento: `${str(row.numerocomprobantefiscal)}|${str(row.fechahora)}|${str(row.puntocobro)}`,
      };
    },
  },
  {
    // Transitos_contrato (Ruta 78: Talagante/Malloco/Padre Hurtado/Rinconada)
    key: "transitos_sol",
    concesionariaDefault: "Autopista del Sol (Ruta 78)",
    required: ["patente", "fecha", "hora", "puntocobro", "clase", "monto"],
    mustNotHave: ["lugar", "rut", "nombre", "fechahora"],
    normalize(row) {
      const fecha = parseDateOnly(row.fecha, "dmy");
      if (!fecha) return null;
      return {
        fecha,
        hora: parseTimeOnly(row.hora),
        concesionaria: "Autopista del Sol (Ruta 78)",
        patente: str(row.patente) || null,
        descripcion: `${str(row.puntocobro)} (${str(row.clase)})`,
        monto: parseMoney(row.monto),
        documento: `${str(row.fecha)}|${str(row.hora)}|${str(row.puntocobro)}`,
      };
    },
  },
  {
    // *_NoFacturados.csv (Costanera Norte)
    key: "cn_no_facturados",
    concesionariaDefault: "Costanera Norte",
    required: [
      "numeroregistro", "tag", "fechahora", "fecha", "hora", "patente",
      "puntocobro", "tipohorario", "categoria", "descimporte", "importe", "nombrecorto",
    ],
    normalize(row) {
      const fecha = parseDateOnly(row.fecha, "dmy");
      if (!fecha) return null;
      return {
        fecha,
        hora: parseTimeOnly(row.hora),
        concesionaria: "Costanera Norte",
        patente: str(row.patente) || null,
        descripcion: `${str(row.puntocobro)} (${str(row.tipohorario).trim()})`,
        monto: parseMoney(row.importe),
        documento: `${str(row.tag)}|${str(row.fechahora)}|${str(row.puntocobro)}|${str(row.numeroregistro)}`,
      };
    },
  },
  {
    // Detalle_Transitos.csv (Costanera Norte, ya facturado)
    key: "cn_detalle_transitos",
    concesionariaDefault: "Costanera Norte",
    required: ["fechahora", "portico", "patente", "categoria", "tag", "kms", "importe", "comprobante", "eje"],
    normalize(row) {
      const { fecha, hora } = splitFechaHoraDMY(row.fechahora);
      if (!fecha) return null;
      return {
        fecha, hora,
        concesionaria: "Costanera Norte",
        patente: str(row.patente) || null,
        descripcion: `${str(row.portico)} (${str(row.eje).trim()})`,
        monto: parseMoney(row.importe),
        documento: `${str(row.fechahora)}|${str(row.portico)}|${str(row.comprobante).trim()}`,
      };
    },
  },
  {
    // peajes-facturados-*.csv (Autopista Central)
    key: "ac_facturados",
    concesionariaDefault: "Autopista Central",
    required: ["nombre", "rut", "nfacturaoboleta", "patente", "portico", "eje", "lugar", "fecha", "hora", "tipodetarifa", "monto"],
    normalize(row) {
      const fecha = parseDateOnly(row.fecha, "ymd");
      if (!fecha) return null;
      return {
        fecha,
        hora: parseTimeOnly(row.hora),
        concesionaria: "Autopista Central",
        patente: str(row.patente) || null,
        descripcion: `${str(row.lugar)} (${str(row.tipodetarifa)})`,
        monto: parseMoney(row.monto),
        documento: `${str(row.nfacturaoboleta)}|${str(row.fecha)}|${str(row.hora)}|${str(row.portico)}`,
      };
    },
  },
  {
    // peajes-no-facturado-*.csv (Autopista Central, sin facturar)
    key: "ac_no_facturados",
    concesionariaDefault: "Autopista Central",
    required: ["nombre", "rut", "patente", "portico", "eje", "lugar", "fecha", "hora", "monto"],
    mustNotHave: ["nfacturaoboleta", "tipodetarifa"],
    normalize(row) {
      const fecha = parseDateOnly(row.fecha, "dmy");
      if (!fecha) return null;
      return {
        fecha,
        hora: parseTimeOnly(row.hora),
        concesionaria: "Autopista Central",
        patente: str(row.patente) || null,
        descripcion: `${str(row.lugar)} (${str(row.eje)})`,
        monto: parseMoney(row.monto),
        documento: `${str(row.patente)}|${str(row.fecha)}|${str(row.hora)}|${str(row.portico)}`,
      };
    },
  },
];

function detectFormat(sampleRow: Record<string, unknown>): FormatSpec | null {
  const keys = new Set(Object.keys(sampleRow));
  for (const spec of FORMATS) {
    const hasAllRequired = spec.required.every((k) => keys.has(k));
    const hasForbidden = spec.mustNotHave?.some((k) => keys.has(k)) ?? false;
    if (hasAllRequired && !hasForbidden) return spec;
  }
  return null;
}

// --- Lectura de archivos ------------------------------------------------------

function detectDelimiter(headerLine: string): string {
  return headerLine.includes(";") ? ";" : ",";
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

async function readCsvRows(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  // Exportes chilenos suelen venir en Windows-1252/Latin-1, no UTF-8.
  const text = new TextDecoder("windows-1252").decode(buf);
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line, delimiter);
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => (row[h] = cols[i] ?? ""));
    return row;
  });
}

async function readExcelRows(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: null });
}

export type ParseResult =
  | { error: string }
  | {
      formatKey: string;
      concesionariaSugerida: string;
      rows: NormalizedPeaje[];
      omitidas: number;
    };

export async function parsePeajesFile(file: File): Promise<ParseResult> {
  const ext = file.name.toLowerCase().split(".").pop();
  let rawRows: Record<string, unknown>[];

  try {
    if (ext === "csv") rawRows = await readCsvRows(file);
    else if (ext === "xls" || ext === "xlsx") rawRows = await readExcelRows(file);
    else return { error: "Formato de archivo no soportado (usa .csv, .xls o .xlsx)." };
  } catch {
    return { error: "No se pudo leer el archivo." };
  }

  if (rawRows.length === 0) return { error: "El archivo no tiene filas de datos." };

  const normalizedRows = rawRows.map(toNormalizedRow);
  const spec = detectFormat(normalizedRows[0]);
  if (!spec) {
    return {
      error:
        "No reconozco el formato de este archivo. Puede ser una concesionaria nueva: pásame una copia y agrego su formato.",
    };
  }

  const parsed: NormalizedPeaje[] = [];
  let omitidas = 0;
  for (const row of normalizedRows) {
    const n = spec.normalize(row);
    if (n && n.monto > 0) parsed.push(n);
    else omitidas++;
  }

  if (parsed.length === 0) {
    return { error: "No se encontraron movimientos válidos en el archivo." };
  }

  return {
    formatKey: spec.key,
    concesionariaSugerida: spec.concesionariaDefault,
    rows: parsed,
    omitidas,
  };
}
