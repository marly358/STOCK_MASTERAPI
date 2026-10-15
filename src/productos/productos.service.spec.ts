import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Categoria } from '../entidades/categoria.entity';
import { Movimiento } from '../entidades/movimiento.entity';
import { Producto } from '../entidades/producto.entity';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ProductosService } from './productos.service';

describe('ProductosService', () => {
  let categorias: Categoria[];
  let productos: Producto[];
  let cantidadMovimientos: number;
  let service: ProductosService;

  beforeEach(() => {
    const categoria = Object.assign(new Categoria(), {
      id: 1,
      nombre: 'Abarrotes',
      descripcion: null,
    });
    categorias = [categoria];
    productos = [];
    cantidadMovimientos = 0;

    const productosRepository = {
      create: (values: Partial<Producto>) =>
        Object.assign(new Producto(), values),
      save: (producto: Producto) => {
        if (!producto.id) {
          producto.id = productos.length + 1;
          productos.push(producto);
        }
        return Promise.resolve(producto);
      },
      find: () => Promise.resolve(productos),
      findOne: (options: { where: FindOptionsWhere<Producto> }) =>
        Promise.resolve(
          productos.find((producto) => producto.id === options.where.id) ??
            null,
        ),
      remove: (producto: Producto) => {
        productos = productos.filter((item) => item.id !== producto.id);
        return Promise.resolve(producto);
      },
    } as unknown as Repository<Producto>;
    const categoriasRepository = {
      findOneBy: (where: FindOptionsWhere<Categoria>) =>
        Promise.resolve(
          categorias.find(
            (categoriaActual) => categoriaActual.id === where.id,
          ) ?? null,
        ),
    } as unknown as Repository<Categoria>;
    const movimientosRepository = {
      count: () => Promise.resolve(cantidadMovimientos),
    } as unknown as Repository<Movimiento>;

    service = new ProductosService(
      productosRepository,
      categoriasRepository,
      movimientosRepository,
    );
  });

  const productoValido: CrearProductoDto = {
    nombre: 'Arroz 1kg',
    precio: 2.5,
    categoriaId: 1,
  };

  it('crea un producto vinculado a una categoría con stock inicial cero', async () => {
    const producto = await service.create(productoValido);

    expect(producto.stockActual).toBe(0);
    expect(producto.precio).toBe('2.50');
    expect(producto.categoria.nombre).toBe('Abarrotes');
  });

  it('rechaza una categoría inexistente', async () => {
    await expect(
      service.create({ ...productoValido, categoriaId: 99 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lista productos y carga su categoría', async () => {
    await service.create(productoValido);

    const lista = await service.findAll();
    expect(lista).toHaveLength(1);
    expect(lista[0]?.nombre).toBe('Arroz 1kg');
    expect(lista[0]?.categoria.id).toBe(1);
  });

  it('consulta un producto existente y devuelve 404 si no existe', async () => {
    const producto = await service.create(productoValido);

    await expect(service.findOne(producto.id)).resolves.toBe(producto);
    await expect(service.findOne(99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('actualiza datos sin alterar el stock', async () => {
    const producto = await service.create(productoValido);
    producto.stockActual = 12;

    const actualizado = await service.update(producto.id, {
      nombre: 'Arroz integral',
      precio: 3.25,
    });

    expect(actualizado.nombre).toBe('Arroz integral');
    expect(actualizado.precio).toBe('3.25');
    expect(actualizado.stockActual).toBe(12);
  });

  it('rechaza una actualización vacía', async () => {
    const dto: ActualizarProductoDto = {};
    await expect(service.update(1, dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('impide eliminar productos con movimientos históricos', async () => {
    const producto = await service.create(productoValido);
    cantidadMovimientos = 1;

    await expect(service.remove(producto.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.findOne(producto.id)).resolves.toBe(producto);
  });

  it('elimina productos que no tienen movimientos', async () => {
    const producto = await service.create(productoValido);

    await expect(service.remove(producto.id)).resolves.toBeUndefined();
    await expect(service.findOne(producto.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
