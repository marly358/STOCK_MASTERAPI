import { ConflictException, NotFoundException } from '@nestjs/common';
import { DeepPartial, FindOptionsWhere, Repository } from 'typeorm';
import { Categoria } from '../entidades/categoria.entity';
import { Producto } from '../entidades/producto.entity';
import { CategoriasService } from './categorias.service';

describe('CategoriasService', () => {
  let categorias: Categoria[];
  let productosAsociados: number;
  let service: CategoriasService;

  beforeEach(() => {
    categorias = [];
    productosAsociados = 0;

    const categoriasRepository = {
      create: (values: DeepPartial<Categoria>) =>
        Object.assign(new Categoria(), values),
      save: (categoria: Categoria) => {
        categoria.id = categorias.length + 1;
        categorias.push(categoria);
        return Promise.resolve(categoria);
      },
      findOneBy: (where: FindOptionsWhere<Categoria>) =>
        Promise.resolve(
          categorias.find((categoria) => {
            if (typeof where.id === 'number' && categoria.id !== where.id) {
              return false;
            }
            if (
              typeof where.nombre === 'string' &&
              categoria.nombre !== where.nombre
            ) {
              return false;
            }
            return true;
          }) ?? null,
        ),
      find: () => Promise.resolve(categorias),
      remove: (categoria: Categoria) => {
        categorias = categorias.filter((item) => item.id !== categoria.id);
        return Promise.resolve(categoria);
      },
    } as unknown as Repository<Categoria>;
    const productosRepository = {
      count: () => Promise.resolve(productosAsociados),
    } as unknown as Repository<Producto>;

    service = new CategoriasService(categoriasRepository, productosRepository);
  });

  it('crea y lista categorías', async () => {
    await service.create({ nombre: 'Bebidas' });

    await expect(service.findAll()).resolves.toHaveLength(1);
  });

  it('rechaza nombres duplicados', async () => {
    await service.create({ nombre: 'Bebidas' });

    await expect(service.create({ nombre: 'Bebidas' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('devuelve 404 para una categoría inexistente', async () => {
    await expect(service.findOne(99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('impide eliminar categorías con productos asociados', async () => {
    await service.create({ nombre: 'Bebidas' });
    productosAsociados = 1;

    await expect(service.remove(1)).rejects.toBeInstanceOf(ConflictException);
  });

  it('elimina categorías sin productos asociados', async () => {
    await service.create({ nombre: 'Bebidas' });

    await expect(service.remove(1)).resolves.toBeUndefined();
    await expect(service.findAll()).resolves.toHaveLength(0);
  });
});
