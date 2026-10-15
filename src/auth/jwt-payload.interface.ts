import { Rol } from '../entidades/rol.enum';

export interface JwtPayload {
  sub: number;
  rol: Rol;
}
