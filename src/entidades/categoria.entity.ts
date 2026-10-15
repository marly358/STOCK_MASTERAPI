import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'categorias' })
export class Categoria {
  @ApiProperty({ description: 'Identificador de la categoría', example: 1 })
  @PrimaryGeneratedColumn({ name: 'id', type: 'int', unsigned: true })
  id!: number;

  @ApiProperty({
    description: 'Nombre único de la categoría',
    example: 'Abarrotes',
  })
  @Column({ name: 'nombre', type: 'varchar', length: 150, unique: true })
  nombre!: string;

  @ApiProperty({
    type: String,
    description: 'Descripción opcional de la categoría',
    nullable: true,
    example: 'Productos de despensa',
  })
  @Column({ name: 'descripcion', type: 'text', nullable: true })
  descripcion!: string | null;
}
