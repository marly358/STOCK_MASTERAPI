import {
  Column,
  Check,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TipoMovimiento } from './tipo-movimiento.enum';
import { Producto } from './producto.entity';
import { Usuario } from './usuario.entity';

@Entity({ name: 'movimientos' })
@Check('chk_movimientos_cantidad_positiva', 'cantidad > 0')
export class Movimiento {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'tipo', type: 'enum', enum: TipoMovimiento })
  tipo!: TipoMovimiento;

  @Column({ name: 'cantidad', type: 'int', unsigned: true })
  cantidad!: number;

  @Column({
    name: 'fecha',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha!: Date;

  @ManyToOne(() => Producto, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'producto_id', referencedColumnName: 'id' })
  producto!: Producto;

  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'usuario_id', referencedColumnName: 'id' })
  usuario!: Usuario;
}
