import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength, MinLength } from 'class-validator';

export class RegistroDto {
  @ApiProperty({ example: 'usuario@ejemplo.com' })
  @IsEmail()
  @MaxLength(254)
  correo!: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @MinLength(8)
  @MaxLength(72)
  contrasena!: string;
}
