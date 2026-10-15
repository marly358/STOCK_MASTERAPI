import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DeepPartial, FindOneOptions } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import type { JwtPayload } from '../src/auth/jwt-payload.interface';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { Rol } from '../src/entidades/rol.enum';
import { Usuario } from '../src/entidades/usuario.entity';
import { UsuariosController } from '../src/usuarios/usuarios.controller';
import { UsuariosService } from '../src/usuarios/usuarios.service';

const TEST_SECRET = 'test-secret-with-at-least-thirty-two-characters';

function accessTokenFrom(body: unknown): string {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('accessToken' in body) ||
    typeof body.accessToken !== 'string'
  ) {
    throw new Error('La respuesta de login no contiene un JWT.');
  }
  return body.accessToken;
}

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

class MemoryUsuarioRepository {
  private readonly users: Usuario[] = [];
  private nextId = 1;

  clear(): void {
    this.users.length = 0;
    this.nextId = 1;
  }

  findOne(options: FindOneOptions<Usuario>): Promise<Usuario | null> {
    const where = Array.isArray(options.where)
      ? options.where[0]
      : options.where;
    if (!where) {
      return Promise.resolve(null);
    }
    return Promise.resolve(
      this.users.find(
        (user) =>
          (where.id === undefined || where.id === user.id) &&
          (where.correo === undefined || where.correo === user.correo),
      ) ?? null,
    );
  }

  create(values: DeepPartial<Usuario>): Usuario {
    return Object.assign(new Usuario(), values);
  }

  save(user: Usuario): Promise<Usuario> {
    user.id = this.nextId;
    this.nextId += 1;
    this.users.push(user);
    return Promise.resolve(user);
  }
}

describe('Autenticación y usuarios (e2e)', () => {
  let app: INestApplication<App>;
  let repository: MemoryUsuarioRepository;
  let jwtService: JwtService;

  beforeAll(async () => {
    repository = new MemoryUsuarioRepository();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({
          secret: TEST_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [AuthController, UsuariosController],
      providers: [
        AuthService,
        UsuariosService,
        JwtStrategy,
        {
          provide: getRepositoryToken(Usuario),
          useValue: repository,
        },
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
    await app.init();
  });

  beforeEach(() => repository.clear());

  afterAll(async () => {
    await app.close();
  });

  it('registra un usuario y no expone su hash', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/registro')
      .send({ correo: 'persona@ejemplo.com', contrasena: 'Clave-segura-123' })
      .expect(201);

    expect(response.body).toEqual({
      id: 1,
      correo: 'persona@ejemplo.com',
      rol: Rol.CONSULTOR,
    });
    expect(response.body).not.toHaveProperty('contrasenaHash');
  });

  it('rechaza el correo duplicado', async () => {
    const data = {
      correo: 'persona@ejemplo.com',
      contrasena: 'Clave-segura-123',
    };
    await request(app.getHttpServer())
      .post('/auth/registro')
      .send(data)
      .expect(201);
    await request(app.getHttpServer())
      .post('/auth/registro')
      .send(data)
      .expect(409);
  });

  it('rechaza una contraseña demasiado corta', async () => {
    await request(app.getHttpServer())
      .post('/auth/registro')
      .send({ correo: 'persona@ejemplo.com', contrasena: 'corta' })
      .expect(400);
  });

  it('rechaza el intento de asignar ADMIN durante el registro', async () => {
    await request(app.getHttpServer())
      .post('/auth/registro')
      .send({
        correo: 'persona@ejemplo.com',
        contrasena: 'Clave-segura-123',
        rol: Rol.ADMIN,
      })
      .expect(400);
  });

  it('inicia sesión y genera un JWT sin datos de contraseña', async () => {
    await request(app.getHttpServer())
      .post('/auth/registro')
      .send({ correo: 'persona@ejemplo.com', contrasena: 'Clave-segura-123' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ correo: 'persona@ejemplo.com', contrasena: 'Clave-segura-123' })
      .expect(200);

    const payload = jwtService.verify<JwtPayload>(
      accessTokenFrom(response.body),
    );
    expect(payload.sub).toBe(1);
    expect(payload.rol).toBe(Rol.CONSULTOR);
    expect(payload).not.toHaveProperty('contrasenaHash');
    expect(response.body).toMatchObject({
      usuario: {
        id: 1,
        correo: 'persona@ejemplo.com',
        rol: Rol.CONSULTOR,
      },
    });
    expect(response.body).not.toHaveProperty('contrasenaHash');
  });

  it('rechaza un inicio de sesión con contraseña incorrecta', async () => {
    await request(app.getHttpServer())
      .post('/auth/registro')
      .send({ correo: 'persona@ejemplo.com', contrasena: 'Clave-segura-123' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ correo: 'persona@ejemplo.com', contrasena: 'Otra-clave-123' })
      .expect(401);
    expect(messageFrom(response.body)).toBe('Credenciales incorrectas.');
  });

  it('protege la consulta de usuario cuando falta el token', async () => {
    await request(app.getHttpServer()).get('/usuarios/yo').expect(401);
  });

  it('rechaza tokens inválidos y vencidos', async () => {
    await request(app.getHttpServer())
      .get('/usuarios/yo')
      .set('Authorization', 'Bearer token.invalido')
      .expect(401);

    const expiredToken = jwtService.sign(
      { sub: 1, rol: Rol.CONSULTOR },
      { expiresIn: -1 },
    );
    await request(app.getHttpServer())
      .get('/usuarios/yo')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });

  it('devuelve el usuario autenticado a partir de la identidad del JWT', async () => {
    await request(app.getHttpServer())
      .post('/auth/registro')
      .send({ correo: 'persona@ejemplo.com', contrasena: 'Clave-segura-123' })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ correo: 'persona@ejemplo.com', contrasena: 'Clave-segura-123' })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/usuarios/yo')
      .set('Authorization', `Bearer ${accessTokenFrom(login.body)}`)
      .expect(200);

    expect(response.body).toEqual({
      id: 1,
      correo: 'persona@ejemplo.com',
      rol: Rol.CONSULTOR,
    });
    expect(response.body).not.toHaveProperty('contrasenaHash');
  });
});
