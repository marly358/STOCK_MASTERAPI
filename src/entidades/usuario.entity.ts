import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Rol } from './rol.enum';

@Entity({ name: 'usuarios' })
export class Usuario {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'correo', type: 'varchar', length: 254, unique: true })
  correo!: string;

  @Column({ name: 'contrasena_hash', type: 'varchar', length: 60 })
  contrasenaHash!: string;

  @Column({
    name: 'rol',
    type: 'enum',
    enum: Rol,
    default: Rol.CONSULTOR,
  })
  rol!: Rol;
}
