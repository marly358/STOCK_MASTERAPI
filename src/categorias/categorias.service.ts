import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Categoria } from '../entidades/categoria.entity';
import { Producto } from '../entidades/producto.entity';
import { ActualizarCategoriaDto } from './dto/actualizar-categoria.dto';
import { CrearCategoriaDto } from './dto/crear-categoria.dto';

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
export class CategoriasService {
  constructor(
    @InjectRepository(Categoria)
    private readonly categoriasRepository: Repository<Categoria>,
    @InjectRepository(Producto)
    private readonly productosRepository: Repository<Producto>,
  ) {}

  async create(dto: CrearCategoriaDto): Promise<Categoria> {
    await this.ensureNameAvailable(dto.nombre);
    return this.saveWithDuplicateHandling(
      this.categoriasRepository.create({
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? null,
      }),
    );
  }

  findAll(): Promise<Categoria[]> {
    return this.categoriasRepository.find({ order: { id: 'ASC' } });
  }

  async findOne(id: number): Promise<Categoria> {
    const categoria = await this.categoriasRepository.findOneBy({ id });
    if (!categoria) {
      throw new NotFoundException(`No existe la categoría ${id}`);
    }
    return categoria;
  }

  async update(id: number, dto: ActualizarCategoriaDto): Promise<Categoria> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Debes proporcionar al menos un campo');
    }
    const categoria = await this.findOne(id);
    if (dto.nombre !== undefined) {
      await this.ensureNameAvailable(dto.nombre, id);
      categoria.nombre = dto.nombre;
    }
    if (dto.descripcion !== undefined) {
      categoria.descripcion = dto.descripcion;
    }
    return this.saveWithDuplicateHandling(categoria);
  }

  async remove(id: number): Promise<void> {
    const categoria = await this.findOne(id);
    const productosAsociados = await this.productosRepository.count({
      where: { categoria: { id } },
    });
    if (productosAsociados > 0) {
      throw new ConflictException(
        'No se puede eliminar una categoría que tiene productos asociados',
      );
    }

    try {
      await this.categoriasRepository.remove(categoria);
    } catch (error: unknown) {
      if (getDatabaseErrorCode(error) === 'ER_ROW_IS_REFERENCED_2') {
        throw new ConflictException(
          'No se puede eliminar una categoría que tiene productos asociados',
        );
      }
      throw error;
    }
  }

  private async saveWithDuplicateHandling(
    categoria: Categoria,
  ): Promise<Categoria> {
    try {
      return await this.categoriasRepository.save(categoria);
    } catch (error: unknown) {
      if (getDatabaseErrorCode(error) === 'ER_DUP_ENTRY') {
        throw new ConflictException('Ya existe una categoría con ese nombre');
      }
      throw error;
    }
  }

  private async ensureNameAvailable(
    nombre: string,
    currentId?: number,
  ): Promise<void> {
    const categoria = await this.categoriasRepository.findOneBy({ nombre });
    if (categoria && categoria.id !== currentId) {
      throw new ConflictException('Ya existe una categoría con ese nombre');
    }
  }
}
