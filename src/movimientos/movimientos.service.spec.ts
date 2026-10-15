import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, FindOperator, Repository } from 'typeorm';
import { TipoMovimiento } from '../entidades/tipo-movimiento.enum';
import { Movimiento } from '../entidades/movimiento.entity';
import { Producto } from '../entidades/producto.entity';
import { Rol } from '../entidades/rol.enum';
import { Usuario } from '../entidades/usuario.entity';
import { CANTIDAD_MAXIMA, STOCK_MAXIMO } from './movimientos.constants';
import { MovimientosService } from './movimientos.service';

/**
 * Entorno transaccional en memoria que imita el comportamiento relevante de
 * MySQL para este módulo:
 *
 * - `increment`/`decrement` condicionales solo aplican si el criterio se
 *   cumple en el momento de la escritura (como un `UPDATE ... WHERE`).
 * - El rollback deshace únicamente los cambios de ESTA transacción (productos
 *   modificados y movimientos insertados por este query runner), igual que
 *   InnoDB, por lo que las transacciones concurrentes no se pisan entre sí.
 *
 * Estas pruebas son unitarias: la concurrencia real con InnoDB se cubre en
 * `test/movimientos.mysql.e2e-spec.ts`.
 */

interface Tienda {
  productos: Producto[];
  usuarios: Usuario[];
  movimientos: Movimiento[];
  siguienteId: number;
  fallarAlGuardarMovimiento: boolean;
}

interface Limite {
  tipo: 'moreThanOrEqual' | 'lessThanOrEqual';
  valor: number;
}

interface FiltroMovimiento {
  id?: number;
  producto?: { id?: number };
  fecha?: FindOperator<Date>;
}

interface OpcionesFindMovimiento {
  where?: FiltroMovimiento;
}

interface ResultadoEscritura {
  affected?: number;
}

function crearProducto(id: number, stockActual: number): Producto {
  const producto = new Producto();
  producto.id = id;
  producto.nombre = `Producto ${id}`;
  producto.precio = '10.00';
  producto.stockActual = stockActual;
  return producto;
}

function crearUsuario(id: number, rol: Rol): Usuario {
  const usuario = new Usuario();
  usuario.id = id;
  usuario.correo = `usuario${id}@ejemplo.com`;
  usuario.contrasenaHash = 'hash-secreto-no-debe-filtrarse';
  usuario.rol = rol;
  return usuario;
}

function extraerLimite(criterio: unknown): Limite | null {
  if (!(criterio instanceof FindOperator)) {
    return null;
  }
  if (criterio.type === 'moreThanOrEqual') {
    return { tipo: 'moreThanOrEqual', valor: Number(criterio.value) };
  }
  if (criterio.type === 'lessThanOrEqual') {
    return { tipo: 'lessThanOrEqual', valor: Number(criterio.value) };
  }
  return null;
}

function evaluarFecha(fecha: Date, operador: FindOperator<Date>): boolean {
  if (operador.type === 'between') {
    const [desde, hasta] = operador.value as unknown as [Date, Date];
    return fecha >= desde && fecha <= hasta;
  }
  const limite = extraerLimite(operador);
  if (!limite) {
    return true;
  }
  const instante = fecha.getTime();
  return limite.tipo === 'moreThanOrEqual'
    ? instante >= limite.valor
    : instante <= limite.valor;
}

function filtrarMovimientos(
  movimientos: Movimiento[],
  where: FiltroMovimiento | undefined,
): Movimiento[] {
  if (!where) {
    return [...movimientos];
  }
  return movimientos.filter((movimiento) => {
    if (where.id !== undefined && movimiento.id !== where.id) {
      return false;
    }
    if (
      where.producto?.id !== undefined &&
      movimiento.producto.id !== where.producto.id
    ) {
      return false;
    }
    if (where.fecha && !evaluarFecha(movimiento.fecha, where.fecha)) {
      return false;
    }
    return true;
  });
}

/** Barrera que libera a todos los participantes cuando llegan `esperados`. */
function crearBarrera(esperados: number): { esperar: () => Promise<void> } {
  let llegarAlFinal: () => void = () => undefined;
  const liberada = new Promise<void>((resolver) => {
    llegarAlFinal = resolver;
  });
  let llegadas = 0;
  return {
    esperar: async (): Promise<void> => {
      llegadas += 1;
      if (llegadas >= esperados) {
        llegarAlFinal();
      }
      await liberada;
    },
  };
}

class GerenteFalso {
  /** Stock anterior de cada producto tocado por ESTA transacción. */
  private readonly stockPrevio = new Map<number, number>();
  /** Movimientos insertados por ESTA transacción. */
  private readonly insertados: Movimiento[] = [];
  /** true = esta transacción adquirió el "candado" de fila. */
  adquirioCandado = false;

  constructor(
    private readonly tienda: Tienda,
    private readonly barrera?: () => Promise<void>,
  ) {}

  async findOne(
    entidad: unknown,
    opciones: { where: { id: number } },
  ): Promise<Producto | Usuario | null> {
    if (entidad === Producto) {
      if (this.barrera && !this.adquirioCandado) {
        this.adquirioCandado = true;
        await this.barrera();
      }
      const producto = this.tienda.productos.find(
        (item) => item.id === opciones.where.id,
      );
      return producto ?? null;
    }
    if (entidad === Usuario) {
      const usuario = this.tienda.usuarios.find(
        (item) => item.id === opciones.where.id,
      );
      return usuario ?? null;
    }
    return null;
  }

  getRepository(entidad: unknown): {
    increment: (
      criterio: { id: number; stockActual: unknown },
      campo: string,
      valor: number,
    ) => Promise<ResultadoEscritura>;
    decrement: (
      criterio: { id: number; stockActual: unknown },
      campo: string,
      valor: number,
    ) => Promise<ResultadoEscritura>;
  } {
    if (entidad !== Producto) {
      throw new Error('Repositorio no soportado en el doble falso');
    }
    return {
      increment: (criterio, _campo, valor) =>
        this.modificarStock(criterio, valor, 1),
      decrement: (criterio, _campo, valor) =>
        this.modificarStock(criterio, valor, -1),
    };
  }

  create(entidad: unknown, valores: Record<string, unknown>): Producto {
    return Object.assign(new (entidad as typeof Producto)(), valores);
  }

  save(entidad: Producto | Movimiento): Promise<Producto | Movimiento> {
    if (entidad instanceof Movimiento) {
      if (this.tienda.fallarAlGuardarMovimiento) {
        return Promise.reject(
          new Error('Fallo simulado al escribir el movimiento'),
        );
      }
      const movimiento = entidad;
      movimiento.id = this.tienda.siguienteId;
      this.tienda.siguienteId += 1;
      this.tienda.movimientos.push(movimiento);
      this.insertados.push(movimiento);
      return Promise.resolve(movimiento);
    }
    return Promise.resolve(entidad);
  }

  /** Simula el rollback de InnoDB: deshace solo lo escrito por esta corrida. */
  deshacerCambios(): void {
    for (const [productoId, stock] of this.stockPrevio) {
      const producto = this.tienda.productos.find(
        (item) => item.id === productoId,
      );
      if (producto) {
        producto.stockActual = stock;
      }
    }
    this.tienda.movimientos = this.tienda.movimientos.filter(
      (movimiento) => !this.insertados.includes(movimiento),
    );
  }

  private modificarStock(
    criterio: { id: number; stockActual: unknown },
    valor: number,
    signo: number,
  ): Promise<ResultadoEscritura> {
    const producto = this.tienda.productos.find(
      (item) => item.id === criterio.id,
    );
    const limite = extraerLimite(criterio.stockActual);
    if (!producto || !limite) {
      return Promise.resolve({ affected: 0 });
    }
    const cumple =
      limite.tipo === 'moreThanOrEqual'
        ? producto.stockActual >= limite.valor
        : producto.stockActual <= limite.valor;
    if (!cumple) {
      return Promise.resolve({ affected: 0 });
    }
    if (!this.stockPrevio.has(producto.id)) {
      this.stockPrevio.set(producto.id, producto.stockActual);
    }
    producto.stockActual += signo * valor;
    return Promise.resolve({ affected: 1 });
  }
}

class QueryRunnerFalso {
  readonly manager: GerenteFalso;

  constructor(tienda: Tienda, barrera?: () => Promise<void>) {
    this.manager = new GerenteFalso(tienda, barrera);
  }

  connect(): Promise<void> {
    return Promise.resolve();
  }

  startTransaction(): Promise<void> {
    return Promise.resolve();
  }

  commitTransaction(): Promise<void> {
    return Promise.resolve();
  }

  rollbackTransaction(): Promise<void> {
    this.manager.deshacerCambios();
    return Promise.resolve();
  }

  release(): Promise<void> {
    return Promise.resolve();
  }
}

function crearDataSource(
  tienda: Tienda,
  barrera?: () => Promise<void>,
): DataSource {
  return {
    createQueryRunner: () => new QueryRunnerFalso(tienda, barrera),
  } as unknown as DataSource;
}

function crearRepositorioMovimientos(tienda: Tienda): Repository<Movimiento> {
  return {
    find: (opciones: OpcionesFindMovimiento): Promise<Movimiento[]> => {
      const filtrados = filtrarMovimientos(tienda.movimientos, opciones.where);
      const ordenados = [...filtrados].sort(
        (a, b) => b.fecha.getTime() - a.fecha.getTime() || b.id - a.id,
      );
      return Promise.resolve(ordenados);
    },
    findOne: (opciones: OpcionesFindMovimiento): Promise<Movimiento | null> => {
      const filtrados = filtrarMovimientos(tienda.movimientos, opciones.where);
      return Promise.resolve(filtrados[0] ?? null);
    },
  } as unknown as Repository<Movimiento>;
}

describe('MovimientosService', () => {
  let tienda: Tienda;
  let service: MovimientosService;

  function preparar(productos: Producto[], usuarios: Usuario[]): void {
    tienda = {
      productos,
      usuarios,
      movimientos: [],
      siguienteId: 1,
      fallarAlGuardarMovimiento: false,
    };
    service = new MovimientosService(
      crearRepositorioMovimientos(tienda),
      crearDataSource(tienda),
    );
  }

  const bodegueroId = 7;

  beforeEach(() => {
    preparar(
      [crearProducto(1, 10)],
      [crearUsuario(bodegueroId, Rol.BODEGUERO)],
    );
  });

  it('registra una entrada y aumenta el stock', async () => {
    const respuesta = await service.crear(
      TipoMovimiento.ENTRADA,
      { productoId: 1, cantidad: 5 },
      bodegueroId,
    );

    expect(tienda.productos[0].stockActual).toBe(15);
    expect(tienda.movimientos).toHaveLength(1);
    expect(respuesta).toMatchObject({
      tipo: TipoMovimiento.ENTRADA,
      cantidad: 5,
      producto: { id: 1, nombre: 'Producto 1' },
      usuario: { id: bodegueroId, rol: Rol.BODEGUERO },
    });
    expect(respuesta.fecha).toBeInstanceOf(Date);
  });

  it('registra una salida y disminuye el stock', async () => {
    const respuesta = await service.crear(
      TipoMovimiento.SALIDA,
      { productoId: 1, cantidad: 4 },
      bodegueroId,
    );

    expect(tienda.productos[0].stockActual).toBe(6);
    expect(tienda.movimientos).toHaveLength(1);
    expect(respuesta.tipo).toBe(TipoMovimiento.SALIDA);
  });

  it('rechaza cantidades inválidas sin tocar el inventario', async () => {
    const invalidas = [0, -2, 2.5, Number.NaN, CANTIDAD_MAXIMA + 1];

    for (const cantidad of invalidas) {
      await expect(
        service.crear(
          TipoMovimiento.SALIDA,
          { productoId: 1, cantidad },
          bodegueroId,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    }

    expect(tienda.productos[0].stockActual).toBe(10);
    expect(tienda.movimientos).toHaveLength(0);
  });

  it('devuelve 404 para un producto inexistente', async () => {
    await expect(
      service.crear(
        TipoMovimiento.ENTRADA,
        { productoId: 99, cantidad: 5 },
        bodegueroId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(tienda.movimientos).toHaveLength(0);
  });

  it('devuelve 401 si la identidad del JWT ya no existe', async () => {
    await expect(
      service.crear(
        TipoMovimiento.ENTRADA,
        { productoId: 1, cantidad: 5 },
        404,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(tienda.productos[0].stockActual).toBe(10);
    expect(tienda.movimientos).toHaveLength(0);
  });

  it('devuelve 409 y no crea movimiento cuando falta stock', async () => {
    await expect(
      service.crear(
        TipoMovimiento.SALIDA,
        { productoId: 1, cantidad: 11 },
        bodegueroId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tienda.productos[0].stockActual).toBe(10);
    expect(tienda.movimientos).toHaveLength(0);
  });

  it('devuelve 409 si la entrada desbordaría el stock máximo', async () => {
    preparar(
      [crearProducto(1, STOCK_MAXIMO - 3)],
      [crearUsuario(bodegueroId, Rol.BODEGUERO)],
    );

    await expect(
      service.crear(
        TipoMovimiento.ENTRADA,
        { productoId: 1, cantidad: 5 },
        bodegueroId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tienda.productos[0].stockActual).toBe(STOCK_MAXIMO - 3);
    expect(tienda.movimientos).toHaveLength(0);
  });

  it('revierte el stock cuando falla la escritura del movimiento', async () => {
    tienda.fallarAlGuardarMovimiento = true;

    await expect(
      service.crear(
        TipoMovimiento.ENTRADA,
        { productoId: 1, cantidad: 5 },
        bodegueroId,
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(tienda.productos[0].stockActual).toBe(10);
    expect(tienda.movimientos).toHaveLength(0);
  });

  it('toma el responsable de la identidad autenticada, no del DTO', async () => {
    preparar(
      [crearProducto(1, 10)],
      [crearUsuario(3, Rol.BODEGUERO), crearUsuario(7, Rol.BODEGUERO)],
    );

    const respuesta = await service.crear(
      TipoMovimiento.SALIDA,
      { productoId: 1, cantidad: 1 },
      7,
    );

    expect(respuesta.usuario.id).toBe(7);
    expect(tienda.movimientos[0].usuario.id).toBe(7);
    expect(respuesta.usuario).not.toHaveProperty('contrasenaHash');
    expect(Object.keys(respuesta.usuario).sort()).toEqual([
      'correo',
      'id',
      'rol',
    ]);
  });

  it('simula salidas concurrentes y nunca deja stock negativo', async () => {
    // Simulación: ambas transacciones adquieren el "candado" y leen el mismo
    // producto antes de escribir; la actualización condicional de MySQL decide
    // quién gana. La concurrencia real se prueba con InnoDB en el e2e MySQL.
    const barrera = crearBarrera(2).esperar;
    service = new MovimientosService(
      crearRepositorioMovimientos(tienda),
      crearDataSource(tienda, barrera),
    );

    const resultados = await Promise.allSettled([
      service.crear(
        TipoMovimiento.SALIDA,
        { productoId: 1, cantidad: 6 },
        bodegueroId,
      ),
      service.crear(
        TipoMovimiento.SALIDA,
        { productoId: 1, cantidad: 6 },
        bodegueroId,
      ),
    ]);

    const cumplidas = resultados.filter(
      (resultado) => resultado.status === 'fulfilled',
    );
    const rechazadas = resultados.filter(
      (resultado) => resultado.status === 'rejected',
    );

    expect(cumplidas).toHaveLength(1);
    expect(rechazadas).toHaveLength(1);
    expect(rechazadas[0].reason).toBeInstanceOf(ConflictException);
    expect(tienda.productos[0].stockActual).toBe(4);
    expect(tienda.movimientos).toHaveLength(1);
  });

  it('consulta el historial filtrando por producto y rango de fechas', async () => {
    const base = new Date('2026-03-10T08:00:00.000Z');
    const producto2 = crearProducto(2, 0);
    tienda.productos.push(producto2);
    const [bodeguero] = tienda.usuarios;
    const movimiento1 = new Movimiento();
    Object.assign(movimiento1, {
      id: 1,
      tipo: TipoMovimiento.ENTRADA,
      cantidad: 2,
      fecha: new Date(base.getTime() + 60_000),
      producto: crearProducto(1, 10),
      usuario: bodeguero,
    });
    const movimiento2 = new Movimiento();
    Object.assign(movimiento2, {
      id: 2,
      tipo: TipoMovimiento.SALIDA,
      cantidad: 3,
      fecha: new Date(base.getTime() + 120_000),
      producto: producto2,
      usuario: bodeguero,
    });
    tienda.movimientos.push(movimiento1, movimiento2);

    const todos = await service.findAll({});
    expect(todos.map((m) => m.id)).toEqual([2, 1]);

    const porProducto = await service.findAll({ productoId: 1 });
    expect(porProducto.map((m) => m.id)).toEqual([1]);

    const porFechas = await service.findAll({
      desde: new Date(base.getTime() + 90_000).toISOString(),
      hasta: new Date(base.getTime() + 180_000).toISOString(),
    });
    expect(porFechas.map((m) => m.id)).toEqual([2]);

    await expect(
      service.findAll({ desde: '2026-03-12', hasta: '2026-03-11' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('devuelve 404 al consultar un movimiento inexistente', async () => {
    await expect(service.findOne(99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('devuelve un movimiento por id sin exponer datos internos', async () => {
    const creada = await service.crear(
      TipoMovimiento.ENTRADA,
      { productoId: 1, cantidad: 5 },
      bodegueroId,
    );

    const movimiento = await service.findOne(creada.id);

    expect(movimiento).toEqual(creada);
    expect(JSON.stringify(movimiento)).not.toContain('contrasenaHash');
  });
});
