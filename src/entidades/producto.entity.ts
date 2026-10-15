import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn({ name: 'id', type: 'int', unsigned: true })
  id!: number;

  @ApiProperty({ example: 'Arroz 1kg', maxLength: 200 })
  @Column({ name: 'nombre', type: 'varchar', length: 200 })
  nombre!: string;

  @ApiPropertyOptional({
    type: String,
    example: 'Arroz blanco de grano largo',
    nullable: true,
  })
  @Column({ name: 'descripcion', type: 'text', nullable: true })
  descripcion!: string | null;

  @ApiProperty({ type: String, example: '2.50' })
  @Column({ name: 'precio', type: 'decimal', precision: 12, scale: 2 })
  precio!: string;

  @ApiProperty({ example: 0, minimum: 0 })
  @Column({ name: 'stock_actual', type: 'int', unsigned: true, default: 0 })
  stockActual!: number;

  @ApiProperty({ type: () => Categoria })
  @ManyToOne(() => Categoria, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoria_id', referencedColumnName: 'id' })
  categoria!: Categoria;
}
