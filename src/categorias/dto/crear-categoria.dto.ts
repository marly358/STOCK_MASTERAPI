import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CrearCategoriaDto {
  @ApiProperty({ example: 'Abarrotes', maxLength: 150 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @Length(1, 150)
  nombre!: string;

  @ApiPropertyOptional({
    type: String,
    example: 'Productos de despensa',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  descripcion?: string | null;
}
