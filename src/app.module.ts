import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { validateEnvironment } from './config/env.validation';
import { Categoria } from './entidades/categoria.entity';
import { Movimiento } from './entidades/movimiento.entity';
import { Producto } from './entidades/producto.entity';
import { Usuario } from './entidades/usuario.entity';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql' as const,
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.getOrThrow<number>('DB_PORT'),
        username: config.getOrThrow<string>('DB_USUARIO'),
        password: config.getOrThrow<string>('DB_CONTRASENA'),
        database: config.getOrThrow<string>('DB_NOMBRE'),
        entities: [Usuario, Categoria, Producto, Movimiento],
        autoLoadEntities: true,
        synchronize:
          config.get<string>('NODE_ENV') === 'development' &&
          config.getOrThrow<boolean>('DB_SINCRONIZAR'),
      }),
    }),
    UsuariosModule,
    AuthModule,
  ],
})
export class AppModule {}
