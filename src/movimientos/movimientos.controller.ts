import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Rol } from '../entidades/rol.enum';
import { TipoMovimiento } from '../entidades/tipo-movimiento.enum';
import type { AuthenticatedUser } from '../usuarios/authenticated-user.interface';
import { CurrentUser } from '../usuarios/current-user.decorator';
import { ConsultarMovimientosDto } from './dto/consultar-movimientos.dto';
import { CrearMovimientoDto } from './dto/crear-movimiento.dto';
import { MovimientoRespuesta } from './movimiento-respuesta';
import { MovimientosService } from './movimientos.service';

@ApiTags('movimientos')
@ApiBearerAuth()
@Controller('movimientos')
@UseGuards(AuthGuard('jwt'))
export class MovimientosController {
  constructor(private readonly movimientosService: MovimientosService) {}

  @Post('entradas')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Rol.BODEGUERO)
  @ApiOperation({ summary: 'Registrar una entrada de inventario (BODEGUERO)' })
  @ApiCreatedResponse({ type: MovimientoRespuesta })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido o vencido' })
  @ApiForbiddenResponse({ description: 'Se requiere el rol BODEGUERO' })
  @ApiNotFoundResponse({ description: 'El producto no existe' })
  @ApiConflictResponse({ description: 'Se excede el stock máximo' })
  registrarEntrada(
    @Body() dto: CrearMovimientoDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ): Promise<MovimientoRespuesta> {
    return this.movimientosService.crear(
      TipoMovimiento.ENTRADA,
      dto,
      usuario.id,
    );
  }

  @Post('salidas')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Rol.BODEGUERO)
  @ApiOperation({ summary: 'Registrar una salida de inventario (BODEGUERO)' })
  @ApiCreatedResponse({ type: MovimientoRespuesta })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido o vencido' })
  @ApiForbiddenResponse({ description: 'Se requiere el rol BODEGUERO' })
  @ApiNotFoundResponse({ description: 'El producto no existe' })
  @ApiConflictResponse({ description: 'Stock insuficiente' })
  registrarSalida(
    @Body() dto: CrearMovimientoDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ): Promise<MovimientoRespuesta> {
    return this.movimientosService.crear(
      TipoMovimiento.SALIDA,
      dto,
      usuario.id,
    );
  }

  @Get()
  @ApiOperation({
    summary:
      'Historial de movimientos (ADMIN, BODEGUERO, CONSULTOR), filtrable por producto y fechas',
  })
  @ApiQuery({ name: 'productoId', required: false, type: Number, minimum: 1 })
  @ApiQuery({
    name: 'desde',
    required: false,
    type: String,
    description: 'YYYY-MM-DD o fecha y hora ISO 8601',
  })
  @ApiQuery({
    name: 'hasta',
    required: false,
    type: String,
    description: 'YYYY-MM-DD o fecha y hora ISO 8601',
  })
  @ApiOkResponse({ type: MovimientoRespuesta, isArray: true })
  @ApiBadRequestResponse({ description: 'Filtros inválidos' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido o vencido' })
  findAll(
    @Query() filtros: ConsultarMovimientosDto,
  ): Promise<MovimientoRespuesta[]> {
    return this.movimientosService.findAll(filtros);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar un movimiento por ID' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Identificador del movimiento',
  })
  @ApiOkResponse({ type: MovimientoRespuesta })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido o vencido' })
  @ApiNotFoundResponse({ description: 'El movimiento no existe' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<MovimientoRespuesta> {
    return this.movimientosService.findOne(id);
  }
}
