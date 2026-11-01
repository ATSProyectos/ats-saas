const DIACRITICOS = /[̀-ͯ]/g;

export function normalizar(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .toLowerCase()
    .trim();
}

export type DestinoGasto = "operacional" | "administrativo" | "excluir";

export type Regla = {
  id: string;
  patron: string;
  etiqueta: string;
  proveedor: string | null;
  destino: DestinoGasto;
  categoria_costo_id: string | null;
  con_iva: boolean;
  nota: string | null;
};

const SOLO_DIGITOS = /^\d+[0-9k]?$/;

/**
 * Busca la regla que clasifica un movimiento.
 *
 * El RUT manda sobre la glosa: el banco trunca la descripción alrededor de los
 * 33 caracteres, así que el nombre suele llegar cortado mientras el RUT queda
 * completo. Entre reglas de glosa gana la más larga, que es la más específica.
 */
export function buscarRegla(
  movimiento: { rut: string | null; glosa: string },
  reglas: Regla[],
): Regla | null {
  if (movimiento.rut) {
    const porRut = reglas.find((r) => r.patron === movimiento.rut);
    if (porRut) return porRut;
  }

  const glosa = normalizar(movimiento.glosa);
  const porGlosa = reglas
    .filter((r) => !SOLO_DIGITOS.test(r.patron) && glosa.includes(r.patron))
    .sort((a, b) => b.patron.length - a.patron.length);

  return porGlosa[0] ?? null;
}

/**
 * Patrón con que se guardará la regla al clasificar a mano. Se prefiere el RUT;
 * si no hay, se usa la glosa normalizada sin los números que cambian en cada
 * movimiento (montos, folios), para que sirva a los próximos cargos iguales.
 */
export function patronSugerido(movimiento: { rut: string | null; glosa: string }): string {
  if (movimiento.rut) return movimiento.rut;
  return normalizar(movimiento.glosa)
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
