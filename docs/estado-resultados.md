# Estado de resultados mensual — ATS Ingeniería y Proyectos

Cómo está construido el EERR de la app, qué criterio usa y qué hay que revisar
cada mes antes de darlo por bueno.

## Qué es y qué no es

El EERR mide **resultado**: si los servicios del mes cubrieron sus costos. No
mide caja. Las dos cosas no cuadran línea a línea y no deben mezclarse:

| Está en el EERR y no en la caja del mes | Está en la caja y no en el EERR |
|---|---|
| Servicio ejecutado en octubre y cobrado en enero | El IVA que se cobra y se paga (el EERR es neto) |
| Depreciación de camiones y plumas (fase 2) | El pago del F29 y los PPM |
| Provisiones de vacaciones e indemnizaciones | La amortización de capital de leasing y créditos |
| | La compra de un camión: sale toda la caja en un mes |
| | Aportes y retiros de socios |

El flujo de caja —registro real más proyección— es un módulo aparte, todavía
no construido. Ver "Lo que falta" al final.

## Criterio y alcance

- **Devengado por fecha de servicio.** Un servicio pesa en el mes en que se
  ejecutó, aunque se facture o se cobre después. La fecha de facturación es un
  acto administrativo que se corre semanas sin que cambie la operación.
- **Gastos operacionales y administrativos**: por su fecha de devengo.
- **Montos netos, sin IVA**: el IVA de las compras es crédito fiscal, no costo.
- **Alcance: hasta EBITDA** (niveles 1 a 4). Depreciación, gastos financieros e
  impuesto a la renta quedan para la fase 2.

## Estructura

```
1 · INGRESOS DE EXPLOTACIÓN      1.1 pluma/hora · 1.2 fletes · 1.3 rigger · 1.4 extras
    ══ T1 TOTAL INGRESOS NETOS
2 · COSTOS DIRECTOS DE SERVICIO  2.1 a 2.9, uno por cada costo de la venta
    ══ T2 TOTAL COSTOS DIRECTOS
    ══ T3 MARGEN BRUTO
3 · COSTOS INDIRECTOS DE OPERACIÓN   3.1 a 3.11 (flota, equipos, personal fijo)
    ══ T4 TOTAL INDIRECTOS
    ══ T5 RESULTADO OPERACIONAL DE FLOTA
4 · GASTOS DE ADMINISTRACIÓN Y VENTAS   4.1 a 4.10
    ══ T6 TOTAL GAV
    0.0 Sin clasificar (gastos sin mapeo: restan, y quedan a la vista)
    ══ T7 EBITDA
```

Las líneas `X.1`, `X.2` y `X.3` quedan **fuera** del resultado y se muestran
aparte: costos que ya entran por otra vía, pagos que no son gasto (IVA, PPM) y
compras de activo fijo.

## De dónde sale cada línea

| Nivel | Fuente |
|---|---|
| 1 y 2 | `ventas_servicios`, una línea por componente de ingreso y por costo directo |
| 3.4 y 3.5 | `consumos_combustible` y `peajes_tag` **sin asignar** a un servicio |
| 3 y 4 | `gastos_operacionales` y `gastos_administrativos`, según su categoría |

Todo pasa por `v_eerr_movimientos`: una fila por documento, ya clasificada.
Desde cualquier línea se puede llegar a las facturas que la componen.

Por construcción, `T1`, `T2` y `T3` son **idénticos** a la suma de
`monto_neto`, `costos_directos` y `margen_bruto` de `ventas_servicios`. Para
comprobarlo:

```sql
select e.mes, e.t1, b.neto, e.t3, b.margen
from (select mes,
        max(monto) filter (where codigo='T1') as t1,
        max(monto) filter (where codigo='T3') as t3
      from public.v_eerr_mensual group by mes) e
join (select date_trunc('month', fecha_servicio)::date as mes,
        sum(monto_neto) as neto, sum(margen_bruto) as margen
      from public.ventas_servicios group by 1) b using (mes);
```

## Cómo se configura (sin tocar código)

Dos tablas controlan el reporte:

- **`eerr_lineas`** — qué líneas existen, en qué orden y a qué subtotal suman
  (`grupo`).
- **`eerr_mapeo`** — a qué línea va cada categoría de costo.

Mover una línea de grupo la saca o la mete en el resultado. Ejemplo: si el IVA
de las facturas de terceros resulta ser crédito recuperable, deja de ser costo:

```sql
update public.eerr_lineas set grupo = 'excluido' where codigo = '2.8';
```

Reclasificar una categoría:

```sql
update public.eerr_mapeo
set linea_codigo = '3.11'
where categoria_costo_id = (
  select id from public.categorias_costo
  where categoria = 'Viáticos' and subcategoria = 'Alojamiento'
);
```

Solo un `admin` puede cambiarlas: el mapeo altera el resultado del mes, no es
una edición operativa. Los cambios quedan en `audit_log`.

## Desglose por tipo de servicio

Ingresos y costos directos se asignan al tipo de servicio de la venta. Los
indirectos y los GAV **no son atribuibles** a un servicio puntual: se
prorratean por participación en los ingresos netos del mes. La suma de las
columnas reproduce exactamente el consolidado.

El tipo de servicio es texto libre: "Izaje" e "izaje" son dos columnas. El
panel de control avisa cuando detecta el mismo tipo escrito de dos formas.

## Panel de control: qué significa cada aviso

| Aviso | Qué hacer |
|---|---|
| **Categoría sin línea asignada** | Mapear la categoría en `eerr_mapeo`; mientras no se haga, el gasto resta del EBITDA en la línea 0.0 |
| **Gasto cargado sin categoría** | Editar el gasto y asignarle categoría |
| **Posible doble conteo** | Hay un gasto operacional ligado a un servicio. Si ese monto también se digitó en los costos directos de la venta, el costo está contado dos veces: dejar uno de los dos |
| **IVA dentro de los costos** | Combustible y peajes entran con el monto del proveedor (IVA incluido), mientras el resto del EERR es neto. El aviso dice cuánto pesa. Se corrige en la importación, guardando neto e IVA por separado |
| **Tipo de servicio escrito de más de una forma** | Normalizar el texto en los servicios afectados |

## Decisiones tomadas y por qué

- **El IVA de terceros (línea 2.8) se muestra como costo.** Así el margen bruto
  del EERR cuadra con el que ya muestran `/ventas` y `/dashboard`. Si ese IVA es
  recuperable, hay que excluir la línea (ver arriba) y el margen sube en ese
  monto.
- **Combustible y peajes entran con el monto del proveedor**, igual que hoy los
  imputa cada módulo al servicio. Cambiarlo a neto aquí descuadraría el EERR
  contra el resto de la app; corresponde arreglarlo en la importación.
- **Los gastos sin mapeo restan del EBITDA** en vez de desaparecer: un costo
  mal clasificado es un problema de mapeo, no una razón para subestimar el
  costo del mes.
- **Las categorías que son tipos de servicio** (`Transporte especializado`,
  `Izaje y montaje`, `Ingeniería de apoyo`, `Arriendo con operador`,
  `Otros servicios`) quedaron mapeadas a la línea 0.0: están en el catálogo de
  costos por error de origen y, si aparece un gasto con ellas, hay que
  corregir la carga.

## Lo que falta

**Fase 2 — completar el EERR hasta resultado neto.** Necesita tablas nuevas:
`activos_fijos` con vida útil y depreciación mensual, `financiamientos` con las
cuotas de leasing y crédito separadas en interés y capital, y la provisión de
impuesto a la renta con tasa parametrizable.

**Fase 3 — flujo de caja.** Registro real más proyección. Antes hay que cerrar
cuatro huecos del modelo de datos:

1. `ventas_servicios.fecha_estimada_pago` existe en la base y no se captura en
   ningún formulario. Es el campo que proyecta la cobranza.
2. `clientes` solo tiene `nombre`: sin condición de pago no se puede calcular
   la fecha estimada como `fecha_facturacion + días`.
3. Los gastos no tienen fecha de vencimiento ni fecha de pago, solo fecha de
   devengo: sirven para el EERR, no permiten proyectar egresos.
4. No hay saldo de caja ni bancos, ni calendario de cuotas de leasing.

**Cierre mensual.** Falta bloquear un mes cerrado para que no cambie después de
informado.
