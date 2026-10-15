import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { CANTIDAD_MAXIMA, CANTIDAD_MINIMA } from '../movimientos.constants';

/**
 * Cuerpo común para `POST /movimientos/entradas` y `POST /movimientos/salidas`.
 *
 * El tipo de movimiento se decide por la ruta, nunca por el cliente. Tampoco
 * se aceptan el usuario responsable ni el stock final: el primero proviene del
 * JWT y el segundo lo calcula el servidor.
 */
export class CrearMovimientoDto {
  @Type(() => Number)
  @IsInt()
  @Min(CANTIDAD_MINIMA)
  productoId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(CANTIDAD_MINIMA)
  @Max(CANTIDAD_MAXIMA)
  cantidad!: number;
}
