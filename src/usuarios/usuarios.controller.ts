import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from './authenticated-user.interface';
import { CurrentUser } from './current-user.decorator';
import { UsuariosService } from './usuarios.service';
import { UsuarioPublico } from './usuarios.service';

@ApiTags('usuarios')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get('yo')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consultar el usuario autenticado' })
  @ApiOkResponse({ type: UsuarioPublico })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido o vencido' })
  @ApiNotFoundResponse({ description: 'El usuario autenticado ya no existe' })
  getCurrentUser(
    @CurrentUser() authenticatedUser: AuthenticatedUser,
  ): Promise<UsuarioPublico> {
    return this.usuariosService.findPublicById(authenticatedUser.id);
  }
}
