import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Rol } from '../entidades/rol.enum';
import { Usuario } from '../entidades/usuario.entity';

export type UsuarioPublico = Pick<Usuario, 'id' | 'correo' | 'rol'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDuplicateEmailError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError) || !isRecord(error.driverError)) {
    return false;
  }
  return (
    error.driverError.code === 'ER_DUP_ENTRY' ||
    error.driverError.errno === 1062
  );
}

function toPublicUser(user: Usuario): UsuarioPublico {
  return { id: user.id, correo: user.correo, rol: user.rol };
}

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuariosRepository: Repository<Usuario>,
  ) {}

  findByEmail(correo: string): Promise<Usuario | null> {
    return this.usuariosRepository.findOne({ where: { correo } });
  }

  async findPublicById(id: number): Promise<UsuarioPublico> {
    const usuario = await this.usuariosRepository.findOne({ where: { id } });
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado.');
    }
    return toPublicUser(usuario);
  }

  async createPublicUser(
    correo: string,
    contrasenaHash: string,
  ): Promise<UsuarioPublico> {
    const usuario = this.usuariosRepository.create({
      correo,
      contrasenaHash,
      rol: Rol.CONSULTOR,
    });
    try {
      return toPublicUser(await this.usuariosRepository.save(usuario));
    } catch (error: unknown) {
      if (isDuplicateEmailError(error)) {
        throw new ConflictException('El correo ya está registrado.');
      }
      throw error;
    }
  }
}
