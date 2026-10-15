import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UsuarioPublico } from '../usuarios/usuarios.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginRespuestaDto } from './dto/login-respuesta.dto';
import { RegistroDto } from './dto/registro.dto';

@ApiTags('autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('registro')
  @ApiOperation({
    summary: 'Registrar una cuenta con rol CONSULTOR',
    description: 'Endpoint público. El rol se asigna en el servidor.',
  })
  @ApiCreatedResponse({ type: UsuarioPublico })
  @ApiBadRequestResponse({
    description: 'Datos inválidos o rol adicional enviado',
  })
  @ApiConflictResponse({ description: 'El correo ya está registrado' })
  register(@Body() dto: RegistroDto): Promise<UsuarioPublico> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesión y obtener un JWT',
    description: 'Endpoint público para obtener un token de acceso.',
  })
  @ApiOkResponse({ type: LoginRespuestaDto })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  @ApiUnauthorizedResponse({ description: 'Credenciales incorrectas' })
  login(@Body() dto: LoginDto): Promise<LoginRespuestaDto> {
    return this.authService.login(dto);
  }
}
