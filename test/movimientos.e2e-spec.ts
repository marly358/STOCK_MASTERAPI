import {
  ConflictException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { Rol } from '../src/entidades/rol.enum';
import { TipoMovimiento } from '../src/entidades/tipo-movimiento.enum';
import { MovimientoRespuesta } from '../src/movimientos/movimiento-respuesta';
import { MovimientosController } from '../src/movimientos/movimientos.controller';
import { MovimientosService } from '../src/movimientos/movimientos.service';

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

function movimientosFrom(body: unknown): MovimientoRespuesta[] {
  if (!Array.isArray(body)) {
    throw new Error('La respuesta no es una lista de movimientos.');
  }
  return body as MovimientoRespuesta[];
}

const MOVIMIENTO: MovimientoRespuesta = {
  id: 1,
  tipo: TipoMovimiento.ENTRADA,
  cantidad: 5,
  fecha: new Date('2026-04-01T10:00:00.000Z'),
  producto: { id: 3, nombre: 'Arroz' },
  usuario: { id: 5, correo: 'bodeguero@ejemplo.com', rol: Rol.BODEGUERO },
};

function tokenDe(jwtService: JwtService, id: number, rol: Rol): string {
  return jwtService.sign({ sub: id, rol });
}

describe('Movimientos (e2e HTTP, servicio simulado)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let servicio: {
    crear: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
  };
  let bodeguero: string;
  let admin: string;
  let consultor: string;

  beforeAll(async () => {
    servicio = {
      crear: jest.fn().mockResolvedValue(MOVIMIENTO),
      findAll: jest.fn().mockResolvedValue([MOVIMIENTO]),
      findOne: jest.fn().mockResolvedValue(MOVIMIENTO),
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({
          secret: TEST_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [MovimientosController],
      providers: [
        JwtStrategy,
        { provide: MovimientosService, useValue: servicio },
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
    jwtService = app.get(JwtService);
    bodeguero = tokenDe(jwtService, 5, Rol.BODEGUERO);
    admin = tokenDe(jwtService, 2, Rol.ADMIN);
    consultor = tokenDe(jwtService, 9, Rol.CONSULTOR);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    servicio.crear.mockClear().mockResolvedValue(MOVIMIENTO);
    servicio.findAll.mockClear().mockResolvedValue([MOVIMIENTO]);
    servicio.findOne.mockClear().mockResolvedValue(MOVIMIENTO);
  });

  describe('autenticación', () => {
    it('devuelve 401 sin token en consultas y registros', async () => {
      await request(app.getHttpServer()).get('/movimientos').expect(401);
      await request(app.getHttpServer()).get('/movimientos/1').expect(401);
      await request(app.getHttpServer())
        .post('/movimientos/entradas')
        .send({ productoId: 1, cantidad: 1 })
        .expect(401);
      await request(app.getHttpServer())
        .post('/movimientos/salidas')
        .send({ productoId: 1, cantidad: 1 })
        .expect(401);

      expect(servicio.crear).not.toHaveBeenCalled();
      expect(servicio.findAll).not.toHaveBeenCalled();
    });

    it('devuelve 401 con un token inválido', async () => {
      await request(app.getHttpServer())
        .get('/movimientos')
        .set('Authorization', 'Bearer token.invalido')
        .expect(401);
    });
  });

  describe('permisos por rol', () => {
    it.each([
      ['entradas', { productoId: 1, cantidad: 2 }],
      ['salidas', { productoId: 1, cantidad: 2 }],
    ])(
      'prohíbe registrar movimientos a ADMIN y CONSULTOR en %s',
      async (ruta, cuerpo) => {
        await request(app.getHttpServer())
          .post(`/movimientos/${ruta}`)
          .set('Authorization', `Bearer ${admin}`)
          .send(cuerpo)
          .expect(403);
        await request(app.getHttpServer())
          .post(`/movimientos/${ruta}`)
          .set('Authorization', `Bearer ${consultor}`)
          .send(cuerpo)
          .expect(403);

        expect(servicio.crear).not.toHaveBeenCalled();
      },
    );

    it('permite consultar el historial a los tres roles', async () => {
      for (const token of [admin, bodeguero, consultor]) {
        await request(app.getHttpServer())
          .get('/movimientos')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
      }
      expect(servicio.findAll).toHaveBeenCalledTimes(3);
    });
  });

  describe('registro de movimientos', () => {
    it('registra una entrada con el tipo de la ruta y el usuario del JWT', async () => {
      const response = await request(app.getHttpServer())
        .post('/movimientos/entradas')
        .set('Authorization', `Bearer ${bodeguero}`)
        .send({ productoId: 3, cantidad: 5 })
        .expect(201);

      expect(servicio.crear).toHaveBeenCalledWith(
        TipoMovimiento.ENTRADA,
        { productoId: 3, cantidad: 5 },
        5,
      );
      expect(response.body).toEqual({
        ...MOVIMIENTO,
        fecha: MOVIMIENTO.fecha.toISOString(),
      });
    });

    it('registra una salida con el tipo de la ruta', async () => {
      await request(app.getHttpServer())
        .post('/movimientos/salidas')
        .set('Authorization', `Bearer ${bodeguero}`)
        .send({ productoId: 3, cantidad: 2 })
        .expect(201);

      expect(servicio.crear).toHaveBeenCalledWith(
        TipoMovimiento.SALIDA,
        { productoId: 3, cantidad: 2 },
        5,
      );
    });

    it('ignora cualquier intento del cliente de definir responsable, tipo o stock', async () => {
      await request(app.getHttpServer())
        .post('/movimientos/entradas')
        .set('Authorization', `Bearer ${bodeguero}`)
        .send({
          productoId: 3,
          cantidad: 5,
          tipo: TipoMovimiento.SALIDA,
          usuario: { id: 99 },
          usuarioId: 99,
          stockActual: 1000,
        })
        .expect(400);

      expect(servicio.crear).not.toHaveBeenCalled();
    });

    it.each([
      ['cantidad cero', { productoId: 1, cantidad: 0 }],
      ['cantidad negativa', { productoId: 1, cantidad: -3 }],
      ['cantidad decimal', { productoId: 1, cantidad: 2.5 }],
      ['cantidad no numérica', { productoId: 1, cantidad: 'muchos' }],
      ['cantidad ausente', { productoId: 1 }],
      ['productoId cero', { productoId: 0, cantidad: 1 }],
      ['productoId no numérico', { productoId: 'uno', cantidad: 1 }],
      ['productoId ausente', { cantidad: 1 }],
    ])('rechaza %s con 400', async (_caso, cuerpo) => {
      await request(app.getHttpServer())
        .post('/movimientos/entradas')
        .set('Authorization', `Bearer ${bodeguero}`)
        .send(cuerpo)
        .expect(400);

      expect(servicio.crear).not.toHaveBeenCalled();
    });

    it('propaga 404 para producto inexistente', async () => {
      servicio.crear.mockRejectedValue(
        new NotFoundException('No existe el producto 99'),
      );

      const response = await request(app.getHttpServer())
        .post('/movimientos/entradas')
        .set('Authorization', `Bearer ${bodeguero}`)
        .send({ productoId: 99, cantidad: 1 })
        .expect(404);

      expect(messageFrom(response.body)).toBe('No existe el producto 99');
    });

    it('propaga 409 para stock insuficiente', async () => {
      servicio.crear.mockRejectedValue(
        new ConflictException('Stock insuficiente para registrar la salida'),
      );

      const response = await request(app.getHttpServer())
        .post('/movimientos/salidas')
        .set('Authorization', `Bearer ${bodeguero}`)
        .send({ productoId: 1, cantidad: 999 })
        .expect(409);

      expect(messageFrom(response.body)).toBe(
        'Stock insuficiente para registrar la salida',
      );
    });
  });

  describe('consultas', () => {
    it('aplica los filtros de producto y fechas como números y cadenas', async () => {
      await request(app.getHttpServer())
        .get('/movimientos')
        .query({ productoId: '2', desde: '2026-01-01', hasta: '2026-01-31' })
        .set('Authorization', `Bearer ${consultor}`)
        .expect(200);

      expect(servicio.findAll).toHaveBeenCalledWith({
        productoId: 2,
        desde: '2026-01-01',
        hasta: '2026-01-31',
      });
    });

    it('rechaza filtros inválidos con 400', async () => {
      await request(app.getHttpServer())
        .get('/movimientos')
        .query({ productoId: 'abc' })
        .set('Authorization', `Bearer ${consultor}`)
        .expect(400);
      await request(app.getHttpServer())
        .get('/movimientos')
        .query({ desde: 'ayer' })
        .set('Authorization', `Bearer ${consultor}`)
        .expect(400);

      expect(servicio.findAll).not.toHaveBeenCalled();
    });

    it('consulta un movimiento por ID y valida el parámetro', async () => {
      await request(app.getHttpServer())
        .get('/movimientos/7')
        .set('Authorization', `Bearer ${consultor}`)
        .expect(200);
      expect(servicio.findOne).toHaveBeenCalledWith(7);

      await request(app.getHttpServer())
        .get('/movimientos/abc')
        .set('Authorization', `Bearer ${consultor}`)
        .expect(400);
      expect(servicio.findOne).toHaveBeenCalledTimes(1);
    });

    it('propaga 404 para un movimiento inexistente', async () => {
      servicio.findOne.mockRejectedValue(
        new NotFoundException('No existe el movimiento 99'),
      );

      await request(app.getHttpServer())
        .get('/movimientos/99')
        .set('Authorization', `Bearer ${consultor}`)
        .expect(404);
    });

    it('las respuestas nunca incluyen datos internos del usuario', async () => {
      const response = await request(app.getHttpServer())
        .get('/movimientos')
        .set('Authorization', `Bearer ${consultor}`)
        .expect(200);

      expect(JSON.stringify(response.body)).not.toContain('contrasenaHash');
      expect(movimientosFrom(response.body)[0].usuario).toEqual({
        id: 5,
        correo: 'bodeguero@ejemplo.com',
        rol: Rol.BODEGUERO,
      });
    });
  });
});
