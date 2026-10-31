import * as XLSX from "xlsx";
import { normalizar } from "./reglas";

export type MovimientoCartola = {
  fecha: string; // YYYY-MM-DD
  glosa: string;
  monto: number; // siempre positivo
  tipo: "cargo" | "abono";
  saldo: number | null;
  rut: string | null; // solo dígitos + dv, extraído de la glosa
};

function claveColumna(s: unknown): string {
  return normalizar(s).replace(/[^a-z0-9]/g, "");
}

/**
 * Extrae el RUT de una glosa y lo deja sin puntos, ceros ni guion.
 *
 * Santander usa dos escrituras según el tipo de movimiento:
 *   "Transf.Internet a 76.024.883-5"   -> 760248835
 *   "0762590409 Transf. FLESAN S.A."   -> 762590409  (9 dígitos + DV, con
 *                                         ceros a la izquierda y sin separador)
 *
 * El RUT importa más que el nombre: el banco trunca la glosa alrededor de los
 * 33 caracteres ("0170827791 Transf a Camilo Alejand"), así que el nombre
 * muchas veces llega cortado y el RUT es lo único completo.
 */
export function extraerRut(glosa: string): string | null {
  const conSeparadores = glosa.match(/(\d{1,2}[.\s]?\d{3}[.\s]?\d{3})\s*-\s*([\dkK])/);
  if (conSeparadores)
    return `${conSeparadores[1].replace(/[.\s]/g, "")}${conSeparadores[2].toLowerCase()}`;

  const pegado = glosa.match(/^(\d{9})([\dkK])(?=\s|$)/);
  if (pegado) {
    const cuerpo = pegado[1].replace(/^0+/, "");
    if (cuerpo.length >= 7) return `${cuerpo}${pegado[2].toLowerCase()}`;
  }
  return null;
}

function aMonto(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Math.abs(v);
  // El banco escribe 1.234.567 (miles con punto) y a veces 1234567,89.
  let s = String(v).trim().replace(/^\$\s?/, "").replace(/\s/g, "");
  if (s === "" || s === "-") return 0;
  const negativo = s.startsWith("-") || /^\(.*\)$/.test(s);
  s = s.replace(/[()\-]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return negativo ? Math.abs(n) : n;
}

function aFecha(v: unknown): string | null {
  if (v instanceof Date) {
    // Las fechas de Excel llegan a medianoche UTC; no restar zona horaria.
    return v.toISOString().slice(0, 10);
  }
  const s = String(v ?? "").trim();
  if (!s) return null;

  const ymd = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;

  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (dmy) {
    const anio = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${anio}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return null;
}

// --- Localización de la cabecera --------------------------------------------
// Una cartola no empieza en la fila 1: arriba trae el titular, el número de
// cuenta y el período. Hay que encontrar la fila que realmente encabeza la
// tabla en vez de asumir que es la primera.

type Columnas = {
  fecha: number;
  glosa: number;
  cargo: number | null;
  abono: number | null;
  monto: number | null;
  tipo: number | null; // columna indicadora "CARGO/ABONO" con A o C
  saldo: number | null;
};

const ES_FECHA = ["fecha", "fechamovimiento", "fechacontable"];
const ES_GLOSA = ["descripcion", "detalle", "glosa", "descripcionmovimiento", "detallemovimiento"];
const ES_CARGO = ["cargo", "cargos", "cargopesos", "cargospesos", "giro", "giros", "debe", "debito"];
const ES_ABONO = ["abono", "abonos", "abonopesos", "abonospesos", "deposito", "depositos", "haber", "credito"];
const ES_MONTO = ["monto", "montomovimiento", "valor"];
const ES_TIPO = ["cargoabono", "abonocargo", "tipomovimiento", "dc"];
const ES_SALDO = ["saldo", "saldopesos", "saldocontable"];

function ubicarColumnas(fila: unknown[]): Columnas | null {
  const claves = fila.map(claveColumna);
  const buscar = (lista: string[]) => {
    const i = claves.findIndex((c) => c !== "" && lista.includes(c));
    return i === -1 ? null : i;
  };

  const fecha = buscar(ES_FECHA);
  const glosa = buscar(ES_GLOSA);
  if (fecha === null || glosa === null) return null;

  const cargo = buscar(ES_CARGO);
  const abono = buscar(ES_ABONO);
  const monto = buscar(ES_MONTO);
  // Sin alguna columna de importe no hay nada que leer.
  if (cargo === null && abono === null && monto === null) return null;

  return { fecha, glosa, cargo, abono, monto, tipo: buscar(ES_TIPO), saldo: buscar(ES_SALDO) };
}

/**
 * Santander separa el archivo en secciones con una fila-banner cuyo título se
 * repite en todas las celdas ("Detalle movimientos", "Saldos diarios"). Esa
 * fila marca el fin de la tabla de movimientos: la cartola provisoria trae
 * "Saldos diarios" justo después, y sin cortar ahí se colarían sus filas.
 */
function esBannerDeSeccion(fila: unknown[]): boolean {
  const celdas = fila.filter((c) => c !== null && c !== undefined && String(c).trim() !== "");
  if (celdas.length < 3) return false;
  const primera = String(celdas[0]).trim();
  return celdas.every((c) => String(c).trim() === primera);
}

/**
 * Lee el cuadro "Saldos" que la cartola trae arriba:
 *
 *   SALDO INICIAL | DEPÓSITOS | OTROS ABONOS | CHEQUES | OTROS CARGOS | ...
 *   1540394       | 0         | 6931460      | 0       | -7016360     | ...
 *
 * Sirve de cuadratura: si lo sumado no coincide con lo que declara el banco,
 * la importación se comió movimientos y hay que mirarla antes de registrarla.
 */
function leerTotalesDeControl(
  filas: unknown[][],
  hastaFila: number,
): { cargos: number; abonos: number } | null {
  for (let i = 0; i < hastaFila; i++) {
    const claves = (filas[i] ?? []).map(claveColumna);
    if (!claves.includes("saldoinicial")) continue;

    const valores = filas[i + 1] ?? [];
    let cargos = 0;
    let abonos = 0;
    let encontrado = false;

    claves.forEach((clave, col) => {
      if (clave === "" || clave === "saldoinicial" || clave === "saldofinal") return;
      const monto = aMonto(valores[col]);
      if (clave.includes("abono") || clave.includes("deposito")) {
        abonos += monto;
        encontrado = true;
      } else if (clave.includes("cargo") || clave.includes("cheque") || clave.includes("impuesto")) {
        cargos += monto;
        encontrado = true;
      }
    });

    if (encontrado) return { cargos, abonos };
  }
  return null;
}

function buscarCabecera(filas: unknown[][]): { indice: number; columnas: Columnas } | null {
  const hasta = Math.min(filas.length, 40);
  for (let i = 0; i < hasta; i++) {
    const columnas = ubicarColumnas(filas[i] ?? []);
    if (columnas) return { indice: i, columnas };
  }
  return null;
}

// --- Lectura del archivo ------------------------------------------------------

async function leerFilas(file: File): Promise<unknown[][]> {
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext === "xls" || ext === "xlsx" || ext === "csv") {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const hoja = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json<unknown[]>(hoja, {
      header: 1,
      blankrows: false,
      defval: null,
      raw: true,
    });
  }
  throw new Error("extension");
}

export type Cuadratura = {
  cargosBanco: number;
  abonosBanco: number;
  cargosLeidos: number;
  abonosLeidos: number;
  cuadra: boolean;
};

export type ResultadoCartola =
  | { error: string }
  | {
      movimientos: MovimientoCartola[];
      omitidas: number;
      cargos: number;
      abonos: number;
      cuadratura: Cuadratura | null;
    };

export async function parseCartola(file: File): Promise<ResultadoCartola> {
  let filas: unknown[][];
  try {
    filas = await leerFilas(file);
  } catch (e) {
    if (e instanceof Error && e.message === "extension")
      return { error: "Formato no soportado. Descarga la cartola en .xlsx, .xls o .csv." };
    return { error: "No se pudo leer el archivo." };
  }

  const cabecera = buscarCabecera(filas);
  if (!cabecera) {
    return {
      error:
        "No encontré la tabla de movimientos. Necesito columnas de fecha, descripción y cargo/abono (o monto). " +
        "Si tu cartola usa otros títulos, mándame el archivo y agrego el formato.",
    };
  }

  const { indice, columnas } = cabecera;
  const movimientos: MovimientoCartola[] = [];
  let omitidas = 0;

  for (const fila of filas.slice(indice + 1)) {
    if (esBannerDeSeccion(fila)) break;

    const fecha = aFecha(fila[columnas.fecha]);
    const glosa = String(fila[columnas.glosa] ?? "").trim();
    if (!fecha || !glosa) {
      omitidas++;
      continue;
    }

    const cargo = columnas.cargo !== null ? aMonto(fila[columnas.cargo]) : 0;
    const abono = columnas.abono !== null ? aMonto(fila[columnas.abono]) : 0;

    // El indicador explícito del banco manda sobre el signo del monto.
    const marca = columnas.tipo !== null ? normalizar(fila[columnas.tipo]).charAt(0) : "";
    const tipoIndicado: "cargo" | "abono" | null =
      marca === "c" ? "cargo" : marca === "a" ? "abono" : null;

    let monto: number;
    let tipo: "cargo" | "abono";
    if (cargo > 0 || abono > 0) {
      // Columnas separadas: el que traiga valor manda.
      tipo = tipoIndicado ?? (cargo > 0 ? "cargo" : "abono");
      monto = cargo > 0 ? cargo : abono;
    } else if (columnas.monto !== null) {
      // Columna única: Santander la trae con signo (negativo = cargo).
      const bruto = fila[columnas.monto];
      const esNegativo =
        (typeof bruto === "number" && bruto < 0) || /^\s*[-(]/.test(String(bruto ?? ""));
      monto = aMonto(bruto);
      tipo = tipoIndicado ?? (esNegativo ? "cargo" : "abono");
    } else {
      omitidas++;
      continue;
    }

    if (monto <= 0) {
      omitidas++;
      continue;
    }

    movimientos.push({
      fecha,
      glosa,
      monto,
      tipo,
      saldo: columnas.saldo !== null ? aMonto(fila[columnas.saldo]) || null : null,
      rut: extraerRut(glosa),
    });
  }

  if (movimientos.length === 0) {
    return { error: "Encontré la tabla pero ninguna fila con fecha, glosa y monto válidos." };
  }

  const suma = (t: "cargo" | "abono") =>
    movimientos.filter((m) => m.tipo === t).reduce((a, m) => a + m.monto, 0);
  const cargosLeidos = suma("cargo");
  const abonosLeidos = suma("abono");

  const control = leerTotalesDeControl(filas, indice);
  const cuadratura: Cuadratura | null = control
    ? {
        cargosBanco: control.cargos,
        abonosBanco: control.abonos,
        cargosLeidos,
        abonosLeidos,
        // Tolerancia de un peso por el redondeo de los montos del banco.
        cuadra:
          Math.abs(control.cargos - cargosLeidos) <= 1 &&
          Math.abs(control.abonos - abonosLeidos) <= 1,
      }
    : null;

  return {
    movimientos,
    omitidas,
    cargos: movimientos.filter((m) => m.tipo === "cargo").length,
    abonos: movimientos.filter((m) => m.tipo === "abono").length,
    cuadratura,
  };
}
