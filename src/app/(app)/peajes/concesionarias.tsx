/**
 * Dónde bajar el detalle de tránsitos de cada concesionaria.
 *
 * Ninguna ofrece API ni descarga automática para clientes, así que el archivo
 * se baja a mano una vez al mes. Esta lista existe para que ese trámite no
 * obligue a recordar seis portales distintos: el enlace va directo al sitio
 * donde está la descarga, y cada ficha dice qué archivo buscar.
 *
 * Los enlaces se verificaron contra los sitios oficiales. Si alguno cambia,
 * se corrige acá y queda arreglado para siempre.
 */

type Concesionaria = {
  nombre: string;
  rutas: string;
  url: string;
  portal: string;
  queBajar: string;
};

const CONCESIONARIAS: Concesionaria[] = [
  {
    nombre: "Costanera Norte",
    rutas: "Kennedy · Santa María · Ruta 5 por el centro",
    url: "https://www.costaneranorte.cl/sucursal_virtual/login.html",
    portal: "Sucursal Virtual",
    queBajar: "Detalle de tránsitos, o «Tránsitos no facturados» para el período en curso",
  },
  {
    nombre: "Autopista Central",
    rutas: "General Velásquez · Ruta 5 Norte-Sur",
    url: "https://www.autopase.cl/",
    portal: "Autopase",
    queBajar: "Detalle de tránsitos facturados y no facturados",
  },
  {
    nombre: "Vespucio Norte (AVN)",
    rutas: "Américo Vespucio norte y poniente",
    url: "https://www.vespucionorte.cl/",
    portal: "Oficina Virtual",
    queBajar: "Detalle de consumos, y «Tránsitos no facturados» para lo del mes",
  },
  {
    nombre: "Vespucio Oriente (AVO)",
    rutas: "Américo Vespucio oriente",
    url: "https://www.avo.cl/contenido/81/ingresa-a-tu-sucursal-virtual",
    portal: "Sucursal Virtual",
    queBajar: "Detalle de viajes",
  },
  {
    nombre: "Autopista del Maipo",
    rutas: "Ruta 5 Sur · Rancagua · Angostura · Paine",
    url: "https://taginterurbano.rutamaipo.cl/",
    portal: "TAG Interurbano",
    queBajar: "Detalle de tránsitos del contrato",
  },
  {
    nombre: "Autopista del Sol",
    rutas: "Ruta 78 · Talagante · Malloco · Padre Hurtado",
    url: "https://oficina-virtual.rutapass.cl/",
    portal: "RutaPass",
    queBajar: "Detalle de tránsitos del contrato",
  },
];

export function Concesionarias() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-700">
        Dónde bajar los tránsitos
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Ninguna concesionaria permite descarga automática, así que el archivo se
        baja a mano. El importador reconoce el formato de las seis, en Excel o
        CSV: basta soltarlo arriba.
      </p>

      <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
        {CONCESIONARIAS.map((c) => (
          <li
            key={c.nombre}
            className="rounded-md border border-gray-200 p-3 hover:border-gray-300"
          >
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-blue-700 underline"
            >
              {c.nombre} · {c.portal} ↗
            </a>
            <p className="mt-0.5 text-xs text-gray-500">{c.rutas}</p>
            <p className="mt-1 text-xs text-gray-600">{c.queBajar}</p>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-gray-500">
        Los períodos que se traslapen no se duplican: cada tránsito se identifica
        por su comprobante, así que puedes bajar de más sin problema.
      </p>
    </div>
  );
}
