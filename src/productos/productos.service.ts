import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Categoria } from '../entidades/categoria.entity';
import { Movimiento } from '../entidades/movimiento.entity';
import { Producto } from '../entidades/producto.entity';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';
import { CrearProductoDto } from './dto/crear-producto.dto';

const SELECCION_PRODUCTO = {
  id: true,
  nombre: true,
  descripcion: true,
  precio: true,
  stockActual: true,
  categoria: { id: true, nombre: true, descripcion: true },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getDatabaseErrorCode(error: unknown): string | undefined {
  if (!isRecord(error)) {
    return undefined;
  }
  const driverError = error['driverError'];
  if (!isRecord(driverError)) {
    return undefined;
  }
  const code = driverError['code'];
  return typeof code === 'string' ? code : undefined;
}

@Injectable()
export class ProductosService {
  constructor(
    @InjectRepository(Producto)
    private readonly productosRepository: Repository<Producto>,
    @InjectRepository(Categoria)
    private readonly categoriasRepository: Repository<Categoria>,
    @InjectRepository(Movimiento)
    private readonly movimientosRepository: Repository<Movimiento>,
  ) {}

  async create(dto: CrearProductoDto): Promise<Producto> {
    const categoria = await this.findCategoria(dto.categoriaId);
    const producto = this.productosRepository.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
      precio: dto.precio.toFixed(2),
      stockActual: 0,
      categoria,
    });
    return this.productosRepository.save(producto);
  }

  findAll(): Promise<Producto[]> {
    return this.productosRepository.find({
      relations: { categoria: true },
      select: SELECCION_PRODUCTO,
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Producto> {
    this.validarId(id);
    const producto = await this.productosRepository.findOne({
      where: { id },
      relations: { categoria: true },
      select: SELECCION_PRODUCTO,
    });
    if (!producto) {
      throw new NotFoundException(`No existe el producto ${id}`);
    }
    return producto;
  }

  async update(id: number, dto: ActualizarProductoDto): Promise<Producto> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Debes proporcionar al menos un campo');
    }
    const producto = await this.findOne(id);
    if (dto.nombre !== undefined) {
      producto.nombre = dto.nombre;
    }
    if (dto.descripcion !== undefined) {
      producto.descripcion = dto.descripcion;
    }
    if (dto.precio !== undefined) {
      producto.precio = dto.precio.toFixed(2);
    }
    if (dto.categoriaId !== undefined) {
      producto.categoria = await this.findCategoria(dto.categoriaId);
    }

    return this.productosRepository.save(producto);
  }

  async remove(id: number): Promise<void> {
    const producto = await this.findOne(id);
    const movimientos = await this.movimientosRepository.count({
      where: { producto: { id } },
    });
    if (movimientos > 0) {
      throw new ConflictException(
        'No se puede eliminar un producto con movimientos históricos',
      );
    }

    try {
      await this.productosRepository.remove(producto);
    } catch (error: unknown) {
      if (getDatabaseErrorCode(error) === 'ER_ROW_IS_REFERENCED_2') {
        throw new ConflictException(
          'No se puede eliminar un producto con movimientos históricos',
        );
      }
      throw error;
    }
  }

  private async findCategoria(id: number): Promise<Categoria> {
    const categoria = await this.categoriasRepository.findOneBy({ id });
    if (!categoria) {
      throw new NotFoundException(`No existe la categoría ${id}`);
    }
    return categoria;
  }

  private validarId(id: number): void {
    if (!Number.isSafeInteger(id) || id < 1) {
      throw new BadRequestException(
        'El identificador debe ser un entero positivo',
      );
    }
  }
}
