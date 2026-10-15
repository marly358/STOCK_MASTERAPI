import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  EntityManager,
  FindOperator,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { TipoMovimiento } from '../entidades/tipo-movimiento.enum';
import { Movimiento } from '../entidades/movimiento.entity';
import { Producto } from '../entidades/producto.entity';
import { Usuario } from '../entidades/usuario.entity';
import { ConsultarMovimientosDto } from './dto/consultar-movimientos.dto';
import { CrearMovimientoDto } from './dto/crear-movimiento.dto';
import { MovimientoRespuesta } from './movimiento-respuesta';
import {
  CANTIDAD_MAXIMA,
  CANTIDAD_MINIMA,
  STOCK_MAXIMO,
} from './movimientos.constants';

const SELECCION_MOVIMIENTO = {
  id: true,
  tipo: true,
  cantidad: true,
  fecha: true,
  producto: { id: true, nombre: true },
  usuario: { id: true, correo: true, rol: true },
} as const;

@Injectable()
export class MovimientosService {
  private readonly logger = new Logger(MovimientosService.name);

  constructor(
    @InjectRepository(Movimiento)
    private readonly movimientosRepository: Repository<Movimiento>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Registra un movimiento dentro de una transacción y actualiza el stock del
   * producto de forma atómica.
   *
   * Concurrencia: la fila del producto se bloquea con `SELECT ... FOR UPDATE`
   * (`pessimistic_write`) para serializar los movimientos del mismo producto y,
   * además, el stock se modifica con una actualización condicional
   * (`increment`/`decrement` con límite) que MySQL evalúa en el momento del
   * `UPDATE`, por lo que nunca puede dejar stock negativo ni desbordarlo.
   */
  async crear(
    tipo: TipoMovimiento,
    dto: CrearMovimientoDto,
    usuarioId: number,
  ): Promise<MovimientoRespuesta> {
    this.validarCantidad(dto.cantidad);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const manager = queryRunner.manager;

      const producto = await manager.findOne(Producto, {
        where: { id: dto.productoId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!producto) {
        throw new NotFoundException(`No existe el producto ${dto.productoId}`);
      }

      const usuario = await manager.findOne(Usuario, {
        where: { id: usuarioId },
      });
      if (!usuario) {
        throw new UnauthorizedException('La identidad del token ya no existe');
      }

      await this.actualizarStock(manager, tipo, producto.id, dto.cantidad);

      const movimiento = manager.create(Movimiento, {
        tipo,
        cantidad: dto.cantidad,
        fecha: new Date(),
        producto: { id: producto.id },
        usuario: { id: usuario.id },
      });
      const guardado = await manager.save(movimiento);
      guardado.producto = producto;
      guardado.usuario = usuario;

      await queryRunner.commitTransaction();
      return this.aRespuesta(guardado);
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      this.relanzar(error);
    } finally {
      await queryRunner.release();
    }
  }

  /** Historial completo con filtros opcionales por producto y fechas. */
  async findAll(
    filtros: ConsultarMovimientosDto,
  ): Promise<MovimientoRespuesta[]> {
    const where: FindOptionsWhere<Movimiento> = {};
    if (filtros.productoId !== undefined) {
      where.producto = { id: filtros.productoId };
    }
    const rango = this.interpretarRango(filtros);
    if (rango) {
      where.fecha = rango;
    }

    const movimientos = await this.movimientosRepository.find({
      where,
      relations: { producto: true, usuario: true },
      select: SELECCION_MOVIMIENTO,
      order: { fecha: 'DESC', id: 'DESC' },
    });
    return movimientos.map((movimiento) => this.aRespuesta(movimiento));
  }

  /** Consulta un movimiento por su identificador. */
  async findOne(id: number): Promise<MovimientoRespuesta> {
    const movimiento = await this.movimientosRepository.findOne({
      where: { id },
      relations: { producto: true, usuario: true },
      select: SELECCION_MOVIMIENTO,
    });
    if (!movimiento) {
      throw new NotFoundException(`No existe el movimiento ${id}`);
    }
    return this.aRespuesta(movimiento);
  }

  /**
   * Actualiza el stock dentro de la transacción con una escritura condicional:
   * una salida solo se aplica si el stock sigue siendo suficiente y una entrada
   * solo si el resultado no desborda la columna. Si la condición falla, no se
   * escribe nada y se propaga un 409.
   */
  private async actualizarStock(
    manager: EntityManager,
    tipo: TipoMovimiento,
    productoId: number,
    cantidad: number,
  ): Promise<void> {
    const repository = manager.getRepository(Producto);
    const esEntrada = tipo === TipoMovimiento.ENTRADA;
    const result = esEntrada
      ? await repository.increment(
          {
            id: productoId,
            stockActual: LessThanOrEqual(STOCK_MAXIMO - cantidad),
          },
          'stockActual',
          cantidad,
        )
      : await repository.decrement(
          {
            id: productoId,
            stockActual: MoreThanOrEqual(cantidad),
          },
          'stockActual',
          cantidad,
        );

    if (!result.affected) {
      throw esEntrada
        ? new ConflictException(
            'La entrada supera el stock máximo admitido por el producto',
          )
        : new ConflictException('Stock insuficiente para registrar la salida');
    }
  }

  private validarCantidad(cantidad: number): void {
    if (
      !Number.isSafeInteger(cantidad) ||
      cantidad < CANTIDAD_MINIMA ||
      cantidad > CANTIDAD_MAXIMA
    ) {
      throw new BadRequestException(
        `La cantidad debe ser un entero entre ${CANTIDAD_MINIMA} y ${CANTIDAD_MAXIMA}`,
      );
    }
  }

  /** Convierte los filtros de fecha en un operador de rango válido. */
  private interpretarRango(
    filtros: ConsultarMovimientosDto,
  ): FindOperator<Date> | undefined {
    const desde = filtros.desde
      ? this.parseFecha(filtros.desde, false)
      : undefined;
    const hasta = filtros.hasta
      ? this.parseFecha(filtros.hasta, true)
      : undefined;
    if (desde && hasta && desde.getTime() > hasta.getTime()) {
      throw new BadRequestException('El intervalo de fechas no es válido');
    }
    if (desde && hasta) {
      return Between(desde, hasta);
    }
    if (desde) {
      return MoreThanOrEqual(desde);
    }
    if (hasta) {
      return LessThanOrEqual(hasta);
    }
    return undefined;
  }

  /** Una fecha sin hora cubre toda la jornada en hora local del servidor. */
  private parseFecha(valor: string, finDeJornada: boolean): Date {
    const esSoloDia = /^\d{4}-\d{2}-\d{2}$/.test(valor);
    return esSoloDia
      ? new Date(`${valor}${finDeJornada ? 'T23:59:59.999' : 'T00:00:00.000'}`)
      : new Date(valor);
  }

  /**
   * Expone únicamente los campos públicos del movimiento: jamás se devuelve el
   * hash de contraseña ni otras columnas internas.
   */
  private aRespuesta(movimiento: Movimiento): MovimientoRespuesta {
    return {
      id: movimiento.id,
      tipo: movimiento.tipo,
      cantidad: movimiento.cantidad,
      fecha: movimiento.fecha,
      producto: {
        id: movimiento.producto.id,
        nombre: movimiento.producto.nombre,
      },
      usuario: {
        id: movimiento.usuario.id,
        correo: movimiento.usuario.correo,
        rol: movimiento.usuario.rol,
      },
    };
  }

  /** Distingue errores de negocio de fallos internos sin filtrar la base. */
  private relanzar(error: unknown): never {
    if (
      error instanceof BadRequestException ||
      error instanceof ConflictException ||
      error instanceof NotFoundException ||
      error instanceof UnauthorizedException
    ) {
      throw error;
    }
    this.logger.error(
      'Error inesperado al registrar el movimiento',
      error instanceof Error ? error.stack : String(error),
    );
    throw new InternalServerErrorException(
      'No se pudo registrar el movimiento',
    );
  }
}
