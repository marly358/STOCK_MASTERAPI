/**
 * Pruebas de integración del módulo de movimientos contra MySQL real
 * (InnoDB): transacciones, bloqueo pesimista de la fila del producto,
 * actualización condicional de stock, rollback real y concurrencia real.
 *
 * Están deshabilitadas por defecto para no romper `npm test` ni
 * `npm run test:e2e` en máquinas sin MySQL. Para ejecutarlas:
 *
 *   DB_TEST_MYSQL=1 npm run test:e2e
 *
 * Variables opcionales: DB_TEST_HOST (localhost), DB_TEST_PORT (3306),
 * DB_TEST_USER (root), DB_TEST_PASSWORD (root),
 * DB_TEST_NOMBRE (stockmaster_test).
 *
 * ATENCIÓN: usa una base de datos DEDICADA de prueba y la sincronización
 * elimina y recrea sus tablas; nunca apuntes a la base de desarrollo.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { Categoria } from '../src/entidades/categoria.entity';
import { Movimiento } from '../src/entidades/movimiento.entity';
import { Producto } from '../src/entidades/producto.entity';
import { Rol } from '../src/entidades/rol.enum';
import { Usuario } from '../src/entidades/usuario.entity';
import { MovimientosModule } from '../src/movimientos/movimientos.module';
import { MovimientoRespuesta } from '../src/movimientos/movimiento-respuesta';

const TEST_SECRET = 'test-secret-with-at-least-thirty-two-characters';

function messageFrom(body: unknown): string {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('message' in body) ||
    typeof body.message !== 'string'
  ) {
    throw new Error('La respuesta de error no contiene un mensaje.');
  }
  return body.message;
}

function movimientoFrom(body: unknown): MovimientoRespuesta {
  if (typeof body !== 'object' || body === null) {
    throw new Error('La respuesta no es un movimiento.');
  }
  return body as MovimientoRespuesta;
}

function movimientosFrom(body: unknown): MovimientoRespuesta[] {
  if (!Array.isArray(body)) {
    throw new Error('La respuesta no es una lista de movimientos.');
  }
  return body as MovimientoRespuesta[];
}

const HABILITADAS = process.env.DB_TEST_MYSQL === '1';
const HOST = process.env.DB_TEST_HOST ?? 'localhost';
const PORT = Number(process.env.DB_TEST_PORT ?? 3306);
const USER = process.env.DB_TEST_USER ?? 'root';
const PASSWORD = process.env.DB_TEST_PASSWORD ?? 'root';
const DATABASE = process.env.DB_TEST_NOMBRE ?? 'stockmaster_test';

const describeMysql = HABILITADAS ? describe : describe.skip;

jest.setTimeout(60_000);

describeMysql('Movimientos (e2e con MySQL real)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let categoria: Categoria;
  let producto: Producto;
  let productoSecundario: Producto;
  let bodeguero: Usuario;
  let bodeguero2: Usuario;
  let admin: Usuario;
  let consultor: Usuario;

  function tokenDe(usuario: Usuario): string {
    return jwtService.sign({ sub: usuario.id, rol: usuario.rol });
  }

  async function stockDe(productoId: number): Promise<number> {
    const entidad = await dataSource
      .getRepository(Producto)
      .findOneByOrFail({ id: productoId });
    return entidad.stockActual;
  }

  async function movimientosDe(productoId: number): Promise<number> {
    return dataSource
      .getRepository(Movimiento)
      .count({ where: { producto: { id: productoId } } });
  }

  async function fijarStock(productoId: number, stock: number): Promise<void> {
    await dataSource
      .getRepository(Producto)
      .update({ id: productoId }, { stockActual: stock });
  }

  beforeAll(async () => {
    const semilla = new DataSource({
      type: 'mysql',
      host: HOST,
      port: PORT,
      username: USER,
      password: PASSWORD,
      synchronize: false,
    });
    await semilla.initialize();
    await semilla.query(`CREATE DATABASE IF NOT EXISTS \`${DATABASE}\``);
    await semilla.destroy();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'mysql',
          host: HOST,
          port: PORT,
          username: USER,
          password: PASSWORD,
          database: DATABASE,
          entities: [Usuario, Categoria, Producto, Movimiento],
          // Base dedicada de pruebas: se limpia al arrancar la suite.
          synchronize: true,
          dropSchema: true,
        }),
        MovimientosModule,
        PassportModule,
        JwtModule.register({
          secret: TEST_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: new ConfigService({ JWT_SECRET: TEST_SECRET }),
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    dataSource = app.get(DataSource);
    jwtService = app.get(JwtService);

    categoria = await dataSource
      .getRepository(Categoria)
      .save({ nombre: 'General', descripcion: null });
    producto = await dataSource.getRepository(Producto).save({
      nombre: 'Arroz 1kg',
      precio: '2.50',
      stockActual: 10,
      categoria,
    });
    productoSecundario = await dataSource.getRepository(Producto).save({
      nombre: 'Azúcar 1kg',
      precio: '3.10',
      stockActual: 0,
      categoria,
    });
    bodeguero = await dataSource.getRepository(Usuario).save({
      correo: 'bodeguero@ejemplo.com',
      contrasenaHash: 'x'.repeat(60),
      rol: Rol.BODEGUERO,
    });
    bodeguero2 = await dataSource.getRepository(Usuario).save({
      correo: 'bodeguero2@ejemplo.com',
      contrasenaHash: 'x'.repeat(60),
      rol: Rol.BODEGUERO,
    });
    admin = await dataSource.getRepository(Usuario).save({
      correo: 'admin@ejemplo.com',
      contrasenaHash: 'x'.repeat(60),
      rol: Rol.ADMIN,
    });
    consultor = await dataSource.getRepository(Usuario).save({
      correo: 'consultor@ejemplo.com',
      contrasenaHash: 'x'.repeat(60),
      rol: Rol.CONSULTOR,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.getRepository(Movimiento).clear();
    await fijarStock(producto.id, 10);
    await fijarStock(productoSecundario.id, 0);
  });

  it('registra una entrada, aumenta el stock y usa el responsable del JWT', async () => {
    const response = await request(app.getHttpServer())
      .post('/movimientos/entradas')
      .set('Authorization', `Bearer ${tokenDe(bodeguero2)}`)
      .send({ productoId: producto.id, cantidad: 5 })
      .expect(201);

    const creado = movimientoFrom(response.body);
    expect(creado).toMatchObject({
      tipo: 'ENTRADA',
      cantidad: 5,
      producto: { id: producto.id, nombre: 'Arroz 1kg' },
      usuario: {
        id: bodeguero2.id,
        correo: 'bodeguero2@ejemplo.com',
        rol: Rol.BODEGUERO,
      },
    });
    expect(creado.fecha).toBeDefined();
    expect(JSON.stringify(response.body)).not.toContain('contrasena');

    await expect(stockDe(producto.id)).resolves.toBe(15);
    const movimiento = await dataSource
      .getRepository(Movimiento)
      .findOne({ where: { id: creado.id }, relations: { usuario: true } });
    expect(movimiento?.usuario.id).toBe(bodeguero2.id);
    expect(movimiento?.tipo).toBe('ENTRADA');
    expect(movimiento?.fecha).toBeInstanceOf(Date);
  });

  it('registra una salida y disminuye el stock', async () => {
    await request(app.getHttpServer())
      .post('/movimientos/salidas')
      .set('Authorization', `Bearer ${tokenDe(bodeguero)}`)
      .send({ productoId: producto.id, cantidad: 4 })
      .expect(201);

    await expect(stockDe(producto.id)).resolves.toBe(6);
    await expect(movimientosDe(producto.id)).resolves.toBe(1);
  });

  it('rechaza una salida sin stock suficiente sin crear movimiento', async () => {
    await request(app.getHttpServer())
      .post('/movimientos/salidas')
      .set('Authorization', `Bearer ${tokenDe(bodeguero)}`)
      .send({ productoId: productoSecundario.id, cantidad: 1 })
      .expect(409);

    await expect(stockDe(productoSecundario.id)).resolves.toBe(0);
    await expect(movimientosDe(productoSecundario.id)).resolves.toBe(0);
  });

  it('devuelve 404 para un producto inexistente', async () => {
    await request(app.getHttpServer())
      .post('/movimientos/entradas')
      .set('Authorization', `Bearer ${tokenDe(bodeguero)}`)
      .send({ productoId: 999_999, cantidad: 1 })
      .expect(404);

    await expect(movimientosDe(producto.id)).resolves.toBe(0);
  });

  it('rechaza cantidades inválidas y campos prohibidos con 400', async () => {
    const token = tokenDe(bodeguero);
    const invalidas = [
      { productoId: producto.id, cantidad: 0 },
      { productoId: producto.id, cantidad: -1 },
      { productoId: producto.id, cantidad: 2.5 },
      { productoId: producto.id, cantidad: 'mucho' },
      { productoId: producto.id },
      { productoId: producto.id, cantidad: 5, usuario: { id: bodeguero.id } },
      { productoId: producto.id, cantidad: 5, stockActual: 999 },
      { productoId: producto.id, cantidad: 5, tipo: 'SALIDA' },
    ];

    for (const cuerpo of invalidas) {
      await request(app.getHttpServer())
        .post('/movimientos/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send(cuerpo)
        .expect(400);
    }

    await expect(stockDe(producto.id)).resolves.toBe(10);
    await expect(movimientosDe(producto.id)).resolves.toBe(0);
  });

  it('exige JWT y el rol BODEGUERO para registrar', async () => {
    const cuerpo = { productoId: producto.id, cantidad: 1 };

    await request(app.getHttpServer())
      .post('/movimientos/entradas')
      .send(cuerpo)
      .expect(401);
    for (const usuario of [admin, consultor]) {
      await request(app.getHttpServer())
        .post('/movimientos/entradas')
        .set('Authorization', `Bearer ${tokenDe(usuario)}`)
        .send(cuerpo)
        .expect(403);
      await request(app.getHttpServer())
        .post('/movimientos/salidas')
        .set('Authorization', `Bearer ${tokenDe(usuario)}`)
        .send(cuerpo)
        .expect(403);
    }

    await expect(movimientosDe(producto.id)).resolves.toBe(0);
  });

  it('permite consultar el historial a los tres roles con filtros', async () => {
    const tokenBodeguero = tokenDe(bodeguero);
    await request(app.getHttpServer())
      .post('/movimientos/entradas')
      .set('Authorization', `Bearer ${tokenBodeguero}`)
      .send({ productoId: producto.id, cantidad: 5 })
      .expect(201);
    await fijarStock(productoSecundario.id, 5);
    await request(app.getHttpServer())
      .post('/movimientos/salidas')
      .set('Authorization', `Bearer ${tokenBodeguero}`)
      .send({ productoId: productoSecundario.id, cantidad: 2 })
      .expect(201);
    // Fija una fecha antigua para poder filtrar por rango.
    await dataSource
      .getRepository(Movimiento)
      .update(
        { producto: { id: productoSecundario.id } },
        { fecha: new Date('2020-05-05T12:00:00.000Z') },
      );

    for (const usuario of [admin, bodeguero, consultor]) {
      const todos = await request(app.getHttpServer())
        .get('/movimientos')
        .set('Authorization', `Bearer ${tokenDe(usuario)}`)
        .expect(200);
      expect(todos.body).toHaveLength(2);
      expect(JSON.stringify(todos.body)).not.toContain('contrasena');
    }

    const porProducto = await request(app.getHttpServer())
      .get('/movimientos')
      .query({ productoId: producto.id })
      .set('Authorization', `Bearer ${tokenDe(consultor)}`)
      .expect(200);
    expect(porProducto.body).toHaveLength(1);
    expect(movimientosFrom(porProducto.body)[0].tipo).toBe('ENTRADA');

    const porRango = await request(app.getHttpServer())
      .get('/movimientos')
      .query({ desde: '2020-01-01', hasta: '2020-12-31' })
      .set('Authorization', `Bearer ${tokenDe(consultor)}`)
      .expect(200);
    expect(porRango.body).toHaveLength(1);
    expect(movimientosFrom(porRango.body)[0].tipo).toBe('SALIDA');

    await request(app.getHttpServer())
      .get('/movimientos')
      .query({ desde: '2021-01-01', hasta: '2020-01-01' })
      .set('Authorization', `Bearer ${tokenDe(consultor)}`)
      .expect(400);
  });

  it('consulta un movimiento por ID o devuelve 404', async () => {
    const creada = await request(app.getHttpServer())
      .post('/movimientos/entradas')
      .set('Authorization', `Bearer ${tokenDe(bodeguero)}`)
      .send({ productoId: producto.id, cantidad: 5 })
      .expect(201);

    const idCreada = movimientoFrom(creada.body).id;
    const consultada = await request(app.getHttpServer())
      .get(`/movimientos/${idCreada}`)
      .set('Authorization', `Bearer ${tokenDe(consultor)}`)
      .expect(200);

    expect(consultada.body).toEqual(creada.body);

    await request(app.getHttpServer())
      .get('/movimientos/999999')
      .set('Authorization', `Bearer ${tokenDe(consultor)}`)
      .expect(404);
  });

  it('no permite stock negativo con salidas concurrentes (InnoDB)', async () => {
    // 5 salidas simultáneas de 3 sobre un stock de 10: solo 3 pueden caber.
    const respuestas = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .post('/movimientos/salidas')
          .set('Authorization', `Bearer ${tokenDe(bodeguero)}`)
          .send({ productoId: producto.id, cantidad: 3 })
          .then((respuesta) => respuesta.status),
      ),
    );

    expect(respuestas.filter((status) => status === 201)).toHaveLength(3);
    expect(respuestas.filter((status) => status === 409)).toHaveLength(2);
    await expect(stockDe(producto.id)).resolves.toBe(1);
    await expect(movimientosDe(producto.id)).resolves.toBe(3);

    // 10 salidas simultáneas de 1 sobre un stock de 5: exactamente 5 caben.
    await fijarStock(producto.id, 5);
    await dataSource.getRepository(Movimiento).clear();
    const segundaTanda = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .post('/movimientos/salidas')
          .set('Authorization', `Bearer ${tokenDe(bodeguero)}`)
          .send({ productoId: producto.id, cantidad: 1 })
          .then((respuesta) => respuesta.status),
      ),
    );

    expect(segundaTanda.filter((status) => status === 201)).toHaveLength(5);
    expect(segundaTanda.filter((status) => status === 409)).toHaveLength(5);
    await expect(stockDe(producto.id)).resolves.toBe(0);
    await expect(movimientosDe(producto.id)).resolves.toBe(5);
  });

  it('revierte el stock si la escritura del movimiento falla dentro de la transacción', async () => {
    await dataSource.query(
      `CREATE TRIGGER trg_movimientos_falla BEFORE INSERT ON movimientos
       FOR EACH ROW
       BEGIN
         IF NEW.cantidad = 7777 THEN
           SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fallo simulado';
         END IF;
       END`,
    );
    try {
      const response = await request(app.getHttpServer())
        .post('/movimientos/entradas')
        .set('Authorization', `Bearer ${tokenDe(bodeguero)}`)
        .send({ productoId: producto.id, cantidad: 7777 })
        .expect(500);

      // No se filtra ningún detalle interno de MySQL.
      expect(messageFrom(response.body)).toBe(
        'No se pudo registrar el movimiento',
      );

      await expect(stockDe(producto.id)).resolves.toBe(10);
      await expect(movimientosDe(producto.id)).resolves.toBe(0);
    } finally {
      await dataSource.query('DROP TRIGGER IF EXISTS trg_movimientos_falla');
    }
  });

  it('no permite editar ni borrar movimientos desde la API', async () => {
    const creada = await request(app.getHttpServer())
      .post('/movimientos/entradas')
      .set('Authorization', `Bearer ${tokenDe(bodeguero)}`)
      .send({ productoId: producto.id, cantidad: 5 })
      .expect(201);

    const idCreada = movimientoFrom(creada.body).id;
    await request(app.getHttpServer())
      .patch(`/movimientos/${idCreada}`)
      .set('Authorization', `Bearer ${tokenDe(bodeguero)}`)
      .send({ cantidad: 1 })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/movimientos/${idCreada}`)
      .set('Authorization', `Bearer ${tokenDe(bodeguero)}`)
      .expect(404);

    await expect(movimientosDe(producto.id)).resolves.toBe(1);
  });
});
