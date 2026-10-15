import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
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
  @ApiProperty({
    description: 'Identificador del producto',
    example: 3,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(CANTIDAD_MINIMA)
  productoId!: number;

  @ApiProperty({
    description: 'Cantidad que ingresa o sale del inventario',
    example: 5,
    minimum: CANTIDAD_MINIMA,
    maximum: CANTIDAD_MAXIMA,
  })
  @Type(() => Number)
  @IsInt()
  @Min(CANTIDAD_MINIMA)
  @Max(CANTIDAD_MAXIMA)
  cantidad!: number;
}
