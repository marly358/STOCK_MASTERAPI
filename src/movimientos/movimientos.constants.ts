/**
 * Límites del módulo de movimientos.
 *
 * - `CANTIDAD_MAXIMA`: tope por movimiento admitido por la API.
 * - `STOCK_MAXIMO`: corresponde al rango de la columna `int unsigned`
 *   de MySQL usada en `productos.stock_actual`, de modo que ninguna
 *   entrada puede desbordarla.
 */
export const CANTIDAD_MINIMA = 1;
export const CANTIDAD_MAXIMA = 1_000_000;
export const STOCK_MAXIMO = 4_294_967_295;
