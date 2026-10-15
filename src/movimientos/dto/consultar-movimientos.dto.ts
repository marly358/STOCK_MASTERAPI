import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsInt, IsOptional, Min } from 'class-validator';

/**
 * Filtros de `GET /movimientos`. Todas las condiciones son opcionales y se
 * combinan entre sí. Las fechas admiten solo día (`YYYY-MM-DD`, de jornada
 * completa) o un ISO 8601 completo con hora.
 */
export class ConsultarMovimientosDto {
  @ApiPropertyOptional({
    description: 'Filtrar por identificador de producto',
    example: 3,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productoId?: number;

  @ApiPropertyOptional({
    description: 'Fecha inicial (YYYY-MM-DD o fecha y hora ISO 8601)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsISO8601()
  desde?: string;

  @ApiPropertyOptional({
    description: 'Fecha final (YYYY-MM-DD o fecha y hora ISO 8601)',
    example: '2026-01-31',
  })
  @IsOptional()
  @IsISO8601()
  hasta?: string;
}
