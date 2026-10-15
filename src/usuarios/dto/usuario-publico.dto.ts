import { ApiProperty } from '@nestjs/swagger';
import { Rol } from '../../entidades/rol.enum';

export class UsuarioPublicoDto {
  @ApiProperty({ description: 'Identificador del usuario', example: 1 })
  id!: number;

  @ApiProperty({
    description: 'Correo electrónico',
    example: 'usuario@ejemplo.com',
  })
  correo!: string;

  @ApiProperty({ enum: Rol, description: 'Rol asignado por el sistema' })
  rol!: Rol;
}
