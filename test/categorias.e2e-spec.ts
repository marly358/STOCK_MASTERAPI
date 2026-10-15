import { INestApplication, ValidationPipe } from '@nestjs/common';
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
import { CategoriasController } from '../src/categorias/categorias.controller';
import { CategoriasService } from '../src/categorias/categorias.service';

const TEST_SECRET = 'test-secret-with-at-least-thirty-two-characters';
const CATEGORIA = { id: 1, nombre: 'Abarrotes', descripcion: null };

function tokenDe(jwtService: JwtService, id: number, rol: Rol): string {
  return jwtService.sign({ sub: id, rol });
}

describe('Categorías (e2e HTTP, servicio simulado)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  const servicio = {
    create: jest.fn().mockResolvedValue(CATEGORIA),
    findAll: jest.fn().mockResolvedValue([CATEGORIA]),
    findOne: jest.fn().mockResolvedValue(CATEGORIA),
    update: jest.fn().mockResolvedValue(CATEGORIA),
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
      controllers: [CategoriasController],
      providers: [
        JwtStrategy,
        RolesGuard,
        { provide: CategoriasService, useValue: servicio },
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
      .setDescription('API para la gestión de inventarios')
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
    servicio.create.mockResolvedValue(CATEGORIA);
    servicio.findAll.mockResolvedValue([CATEGORIA]);
    servicio.findOne.mockResolvedValue(CATEGORIA);
    servicio.update.mockResolvedValue(CATEGORIA);
    servicio.remove.mockResolvedValue(undefined);
  });

  it('exige autenticación válida para consultar categorías', async () => {
    await request(app.getHttpServer()).get('/categorias').expect(401);
    await request(app.getHttpServer())
      .get('/categorias')
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);
  });

  it('permite a todos los roles autenticados listar y consultar categorías', async () => {
    for (const token of tokens.values()) {
      await request(app.getHttpServer())
        .get('/categorias')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      await request(app.getHttpServer())
        .get('/categorias/1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(servicio.findAll).toHaveBeenCalled();
      expect(servicio.findOne).toHaveBeenCalledWith(1);
    }
  });

  it('permite crear, actualizar y eliminar solo a ADMIN', async () => {
    const admin = tokens.get(Rol.ADMIN);
    if (!admin) {
      throw new Error('No se generó el token ADMIN de prueba');
    }
    await request(app.getHttpServer())
      .post('/categorias')
      .set('Authorization', `Bearer ${admin}`)
      .send({ nombre: 'Abarrotes' })
      .expect(201);
    await request(app.getHttpServer())
      .patch('/categorias/1')
      .set('Authorization', `Bearer ${admin}`)
      .send({ nombre: 'Granos' })
      .expect(200);
    await request(app.getHttpServer())
      .delete('/categorias/1')
      .set('Authorization', `Bearer ${admin}`)
      .expect(204);

    expect(servicio.create).toHaveBeenCalledTimes(1);
    expect(servicio.update).toHaveBeenCalledTimes(1);
    expect(servicio.remove).toHaveBeenCalledWith(1);
  });

  it.each([Rol.BODEGUERO, Rol.CONSULTOR])(
    'rechaza cambios de categoría para %s',
    async (rol) => {
      const token = tokens.get(rol);
      if (!token) {
        throw new Error(`No se generó el token ${rol} de prueba`);
      }
      await request(app.getHttpServer())
        .post('/categorias')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Abarrotes' })
        .expect(403);
      await request(app.getHttpServer())
        .patch('/categorias/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Granos' })
        .expect(403);
      await request(app.getHttpServer())
        .delete('/categorias/1')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    },
  );

  it('rechaza propiedades desconocidas en los DTO de categorías', async () => {
    const admin = tokens.get(Rol.ADMIN);
    if (!admin) {
      throw new Error('No se generó el token ADMIN de prueba');
    }
    await request(app.getHttpServer())
      .post('/categorias')
      .set('Authorization', `Bearer ${admin}`)
      .send({ nombre: 'Abarrotes', rol: Rol.ADMIN })
      .expect(400);
    expect(servicio.create).not.toHaveBeenCalled();
  });

  it('publica la especificación OpenAPI con categorías y Bearer JWT', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    expect(response.text).toContain('"title":"StockMaster"');
    expect(response.text).toContain('"/categorias"');
    expect(response.text).toContain('"security":[{"bearer":[]}');
    expect(response.text).toContain('"403":{"description"');
    expect(response.text).toContain('"bearer":{"scheme":"bearer"');
    expect(response.text).toContain('"CrearCategoriaDto"');
    expect(response.text).toContain('"descripcion":{"type":"string"');
  });
});
