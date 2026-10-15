import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from './authenticated-user.interface';
import { CurrentUser } from './current-user.decorator';
import { UsuariosService } from './usuarios.service';
import type { UsuarioPublico } from './usuarios.service';

@ApiTags('usuarios')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get('yo')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consultar el usuario autenticado' })
  getCurrentUser(
    @CurrentUser() authenticatedUser: AuthenticatedUser,
  ): Promise<UsuarioPublico> {
    return this.usuariosService.findPublicById(authenticatedUser.id);
  }
}
