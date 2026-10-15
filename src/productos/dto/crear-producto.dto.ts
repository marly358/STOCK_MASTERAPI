import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CrearProductoDto {
  @ApiProperty({ example: 'Arroz 1kg', maxLength: 200 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  nombre!: string;

  @ApiPropertyOptional({
    type: String,
    example: 'Arroz blanco de grano largo',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(65535)
  descripcion?: string | null;

  @ApiProperty({ example: 2.5, minimum: 0, maximum: 9999999999.99 })
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(9999999999.99)
  precio!: number;

  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  categoriaId!: number;
}
