import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Categoria } from './categoria.entity';

@Entity({ name: 'productos' })
export class Producto {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'nombre', type: 'varchar', length: 200 })
  nombre!: string;

  @Column({ name: 'descripcion', type: 'text', nullable: true })
  descripcion!: string | null;

  @Column({ name: 'precio', type: 'decimal', precision: 12, scale: 2 })
  precio!: string;

  @Column({ name: 'stock_actual', type: 'int', unsigned: true, default: 0 })
  stockActual!: number;

  @ManyToOne(() => Categoria, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoria_id', referencedColumnName: 'id' })
  categoria!: Categoria;
}
