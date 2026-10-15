import { Rol } from '../entidades/rol.enum';

export interface AuthenticatedUser {
  id: number;
  rol: Rol;
}
