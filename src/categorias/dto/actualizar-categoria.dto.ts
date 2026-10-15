import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class ActualizarCategoriaDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 150)
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string | null;
}
