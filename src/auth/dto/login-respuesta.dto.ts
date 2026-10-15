import { ApiProperty } from '@nestjs/swagger';
import { UsuarioPublicoDto } from '../../usuarios/dto/usuario-publico.dto';

export class LoginRespuestaDto {
  @ApiProperty({ description: 'Token JWT de acceso' })
  accessToken!: string;

  @ApiProperty({ type: UsuarioPublicoDto })
  usuario!: UsuarioPublicoDto;
}
