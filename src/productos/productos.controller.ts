import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Rol } from '../entidades/rol.enum';
import { Producto } from '../entidades/producto.entity';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ProductosService } from './productos.service';

@ApiTags('productos')
@ApiBearerAuth()
@Controller('productos')
@UseGuards(AuthGuard('jwt'))
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Rol.ADMIN, Rol.BODEGUERO)
  @ApiOperation({ summary: 'Crear un producto con stock inicial cero' })
  @ApiCreatedResponse({ type: Producto })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido o vencido' })
  @ApiForbiddenResponse({ description: 'Se requiere ADMIN o BODEGUERO' })
  @ApiNotFoundResponse({ description: 'La categoría no existe' })
  create(@Body() dto: CrearProductoDto): Promise<Producto> {
    return this.productosService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar productos con su categoría' })
  @ApiOkResponse({ type: Producto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido o vencido' })
  findAll(): Promise<Producto[]> {
    return this.productosService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar un producto por ID' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Identificador del producto',
  })
  @ApiOkResponse({ type: Producto })
  @ApiBadRequestResponse({ description: 'Identificador inválido' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido o vencido' })
  @ApiNotFoundResponse({ description: 'El producto no existe' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Producto> {
    return this.productosService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Actualizar los datos de un producto' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Identificador del producto',
  })
  @ApiOkResponse({ type: Producto })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido o vencido' })
  @ApiForbiddenResponse({ description: 'Se requiere el rol ADMIN' })
  @ApiNotFoundResponse({ description: 'El producto o la categoría no existen' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarProductoDto,
  ): Promise<Producto> {
    return this.productosService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Rol.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un producto sin movimientos históricos' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Identificador del producto',
  })
  @ApiNoContentResponse({ description: 'Producto eliminado' })
  @ApiBadRequestResponse({ description: 'Identificador inválido' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido o vencido' })
  @ApiForbiddenResponse({ description: 'Se requiere el rol ADMIN' })
  @ApiNotFoundResponse({ description: 'El producto no existe' })
  @ApiConflictResponse({
    description: 'El producto tiene movimientos históricos',
  })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.productosService.remove(id);
  }
}
