import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Rol } from '../entidades/rol.enum';
import { AuthenticatedUser } from '../usuarios/authenticated-user.interface';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRol(value: unknown): value is Rol {
  return Object.values(Rol).some((rol) => rol === value);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: unknown): AuthenticatedUser {
    if (
      !isRecord(payload) ||
      typeof payload.sub !== 'number' ||
      !Number.isSafeInteger(payload.sub) ||
      payload.sub <= 0 ||
      !isRol(payload.rol)
    ) {
      throw new UnauthorizedException();
    }
    return { id: payload.sub, rol: payload.rol };
  }
}
