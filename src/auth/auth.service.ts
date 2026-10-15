import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsuarioPublico, UsuariosService } from '../usuarios/usuarios.service';
import { LoginDto } from './dto/login.dto';
import { RegistroDto } from './dto/registro.dto';
import { JwtPayload } from './jwt-payload.interface';

const BCRYPT_SALT_ROUNDS = 12;
const BCRYPT_MAX_PASSWORD_BYTES = 72;

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegistroDto): Promise<UsuarioPublico> {
    const correo = dto.correo.trim().toLowerCase();
    if (Buffer.byteLength(dto.contrasena, 'utf8') > BCRYPT_MAX_PASSWORD_BYTES) {
      throw new BadRequestException(
        'La contraseña excede la longitud admitida.',
      );
    }
    if (await this.usuariosService.findByEmail(correo)) {
      throw new ConflictException('El correo ya está registrado.');
    }
    const contrasenaHash = await bcrypt.hash(
      dto.contrasena,
      BCRYPT_SALT_ROUNDS,
    );
    return this.usuariosService.createPublicUser(correo, contrasenaHash);
  }

  async login(
    dto: LoginDto,
  ): Promise<{ accessToken: string; usuario: UsuarioPublico }> {
    const correo = dto.correo.trim().toLowerCase();
    const usuario = await this.usuariosService.findByEmail(correo);
    const passwordMatches = usuario
      ? await bcrypt.compare(dto.contrasena, usuario.contrasenaHash)
      : false;
    if (!usuario || !passwordMatches) {
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

    const payload: JwtPayload = { sub: usuario.id, rol: usuario.rol };
    const accessToken = await this.jwtService.signAsync(payload);
    return {
      accessToken,
      usuario: { id: usuario.id, correo: usuario.correo, rol: usuario.rol },
    };
  }
}
