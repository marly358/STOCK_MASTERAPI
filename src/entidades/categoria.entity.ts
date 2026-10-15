import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'categorias' })
export class Categoria {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'nombre', type: 'varchar', length: 150, unique: true })
  nombre!: string;

  @Column({ name: 'descripcion', type: 'text', nullable: true })
  descripcion!: string | null;
}
