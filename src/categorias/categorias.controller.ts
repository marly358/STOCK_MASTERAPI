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
  ApiBearerAuth,
  ApiBadRequestResponse,
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
import { Categoria } from '../entidades/categoria.entity';
import { ActualizarCategoriaDto } from './dto/actualizar-categoria.dto';
import { CrearCategoriaDto } from './dto/crear-categoria.dto';
import { CategoriasService } from './categorias.service';

@ApiTags('categorías')
@ApiBearerAuth()
@Controller('categorias')
@UseGuards(AuthGuard('jwt'))
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Crear una categoría' })
  @ApiCreatedResponse({ type: Categoria })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido o vencido' })
  @ApiForbiddenResponse({ description: 'Se requiere el rol ADMIN' })
  @ApiConflictResponse({
    description: 'Ya existe una categoría con ese nombre',
  })
  create(@Body() dto: CrearCategoriaDto): Promise<Categoria> {
    return this.categoriasService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar categorías' })
  @ApiOkResponse({ type: Categoria, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido o vencido' })
  findAll(): Promise<Categoria[]> {
    return this.categoriasService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar una categoría por ID' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Identificador de categoría',
  })
  @ApiOkResponse({ type: Categoria })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido o vencido' })
  @ApiNotFoundResponse({ description: 'La categoría no existe' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Categoria> {
    return this.categoriasService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Actualizar una categoría' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Identificador de categoría',
  })
  @ApiOkResponse({ type: Categoria })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido o vencido' })
  @ApiForbiddenResponse({ description: 'Se requiere el rol ADMIN' })
  @ApiNotFoundResponse({ description: 'La categoría no existe' })
  @ApiConflictResponse({
    description: 'Ya existe una categoría con ese nombre',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarCategoriaDto,
  ): Promise<Categoria> {
    return this.categoriasService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Rol.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Categoría eliminada' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Identificador de categoría',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido o vencido' })
  @ApiForbiddenResponse({ description: 'Se requiere el rol ADMIN' })
  @ApiNotFoundResponse({ description: 'La categoría no existe' })
  @ApiConflictResponse({
    description: 'La categoría tiene productos asociados',
  })
  @ApiOperation({ summary: 'Eliminar una categoría sin productos asociados' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.categoriasService.remove(id);
  }
}
