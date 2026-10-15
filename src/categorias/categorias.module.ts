import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Categoria } from '../entidades/categoria.entity';
import { Producto } from '../entidades/producto.entity';
import { RolesGuard } from '../auth/roles.guard';
import { CategoriasController } from './categorias.controller';
import { CategoriasService } from './categorias.service';

@Module({
  imports: [TypeOrmModule.forFeature([Categoria, Producto])],
  controllers: [CategoriasController],
  providers: [CategoriasService, RolesGuard],
})
export class CategoriasModule {}
