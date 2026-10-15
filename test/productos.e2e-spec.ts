import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { RolesGuard } from '../src/auth/roles.guard';
import { Rol } from '../src/entidades/rol.enum';
import { ProductosController } from '../src/productos/productos.controller';
import { ProductosService } from '../src/productos/productos.service';

const TEST_SECRET = 'test-secret-with-at-least-thirty-two-characters';
const PRODUCTO = {
  id: 1,
  nombre: 'Arroz 1kg',
  descripcion: null,
  precio: '2.50',
  stockActual: 0,
  categoria: { id: 1, nombre: 'Abarrotes', descripcion: null },
};

function tokenDe(jwtService: JwtService, id: number, rol: Rol): string {
  return jwtService.sign({ sub: id, rol });
}

describe('Productos (e2e HTTP, servicio simulado)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  const servicio = {
    create: jest.fn().mockResolvedValue(PRODUCTO),
    findAll: jest.fn().mockResolvedValue([PRODUCTO]),
    findOne: jest.fn().mockResolvedValue(PRODUCTO),
    update: jest.fn().mockResolvedValue(PRODUCTO),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const tokens = new Map<Rol, string>();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({
          secret: TEST_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [ProductosController],
      providers: [
        JwtStrategy,
        RolesGuard,
        { provide: ProductosService, useValue: servicio },
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
    const swaggerConfig = new DocumentBuilder()
      .setTitle('StockMaster')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
    jwtService = app.get(JwtService);
    for (const rol of Object.values(Rol)) {
      tokens.set(rol, tokenDe(jwtService, 4, rol));
    }
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    servicio.create.mockResolvedValue(PRODUCTO);
    servicio.findAll.mockResolvedValue([PRODUCTO]);
    servicio.findOne.mockResolvedValue(PRODUCTO);
    servicio.update.mockResolvedValue(PRODUCTO);
    servicio.remove.mockResolvedValue(undefined);
  });

  it('exige autenticación para consultar productos', async () => {
    await request(app.getHttpServer()).get('/productos').expect(401);
    await request(app.getHttpServer())
      .get('/productos')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('permite a los tres roles autenticados listar y consultar', async () => {
    for (const token of tokens.values()) {
      await request(app.getHttpServer())
        .get('/productos')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      await request(app.getHttpServer())
        .get('/productos/1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    }
    expect(servicio.findAll).toHaveBeenCalledTimes(3);
    expect(servicio.findOne).toHaveBeenCalledTimes(3);
  });

  it('permite crear a ADMIN y BODEGUERO, pero no a CONSULTOR', async () => {
    for (const rol of [Rol.ADMIN, Rol.BODEGUERO]) {
      const token = tokens.get(rol);
      if (!token) {
        throw new Error(`No se generó el token ${rol} de prueba`);
      }
      await request(app.getHttpServer())
        .post('/productos')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Arroz 1kg', precio: 2.5, categoriaId: 1 })
        .expect(201);
    }
    const consultor = tokens.get(Rol.CONSULTOR);
    if (!consultor) {
      throw new Error('No se generó el token CONSULTOR de prueba');
    }
    await request(app.getHttpServer())
      .post('/productos')
      .set('Authorization', `Bearer ${consultor}`)
      .send({ nombre: 'Arroz 1kg', precio: 2.5, categoriaId: 1 })
      .expect(403);
    expect(servicio.create).toHaveBeenCalledTimes(2);
  });

  it('solo permite actualizar y eliminar a ADMIN', async () => {
    const admin = tokens.get(Rol.ADMIN);
    if (!admin) {
      throw new Error('No se generó el token ADMIN de prueba');
    }
    await request(app.getHttpServer())
      .patch('/productos/1')
      .set('Authorization', `Bearer ${admin}`)
      .send({ nombre: 'Arroz integral' })
      .expect(200);
    await request(app.getHttpServer())
      .delete('/productos/1')
      .set('Authorization', `Bearer ${admin}`)
      .expect(204);

    for (const rol of [Rol.BODEGUERO, Rol.CONSULTOR]) {
      const token = tokens.get(rol);
      if (!token) {
        throw new Error(`No se generó el token ${rol} de prueba`);
      }
      await request(app.getHttpServer())
        .patch('/productos/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Arroz integral' })
        .expect(403);
      await request(app.getHttpServer())
        .delete('/productos/1')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    }
    expect(servicio.update).toHaveBeenCalledTimes(1);
    expect(servicio.remove).toHaveBeenCalledTimes(1);
  });

  it('rechaza nombres y precios inválidos', async () => {
    const admin = tokens.get(Rol.ADMIN);
    if (!admin) {
      throw new Error('No se generó el token ADMIN de prueba');
    }
    await request(app.getHttpServer())
      .post('/productos')
      .set('Authorization', `Bearer ${admin}`)
      .send({ nombre: ' ', precio: 1, categoriaId: 1 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/productos')
      .set('Authorization', `Bearer ${admin}`)
      .send({ nombre: 'Arroz', precio: -1, categoriaId: 1 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/productos')
      .set('Authorization', `Bearer ${admin}`)
      .send({ nombre: 'Arroz', precio: 1.001, categoriaId: 1 })
      .expect(400);
    expect(servicio.create).not.toHaveBeenCalled();
  });

  it('rechaza stock explícito en creación y actualización', async () => {
    const admin = tokens.get(Rol.ADMIN);
    if (!admin) {
      throw new Error('No se generó el token ADMIN de prueba');
    }
    await request(app.getHttpServer())
      .post('/productos')
      .set('Authorization', `Bearer ${admin}`)
      .send({
        nombre: 'Arroz 1kg',
        precio: 2.5,
        categoriaId: 1,
        stockActual: 100,
      })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/productos/1')
      .set('Authorization', `Bearer ${admin}`)
      .send({ stockActual: 100 })
      .expect(400);
    expect(servicio.create).not.toHaveBeenCalled();
    expect(servicio.update).not.toHaveBeenCalled();
  });

  it('valida categoría inexistente a través del servicio', async () => {
    const admin = tokens.get(Rol.ADMIN);
    if (!admin) {
      throw new Error('No se generó el token ADMIN de prueba');
    }
    servicio.create.mockRejectedValueOnce(
      new NotFoundException('No existe la categoría 99'),
    );
    await request(app.getHttpServer())
      .post('/productos')
      .set('Authorization', `Bearer ${admin}`)
      .send({ nombre: 'Arroz', precio: 1, categoriaId: 99 })
      .expect(404);
  });

  it('publica rutas y esquemas de productos en OpenAPI', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);

    expect(response.text).toContain('"/productos"');
    expect(response.text).toContain('"/productos/{id}"');
    expect(response.text).toContain('"CrearProductoDto"');
    expect(response.text).toContain('"ActualizarProductoDto"');
    expect(response.text).toContain('"stockActual"');
    expect(response.text).toContain('"categoriaId"');
  });
});
