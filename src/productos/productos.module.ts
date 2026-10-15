import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../auth/roles.guard';
import { Categoria } from '../entidades/categoria.entity';
import { Movimiento } from '../entidades/movimiento.entity';
import { Producto } from '../entidades/producto.entity';
import { ProductosController } from './productos.controller';
import { ProductosService } from './productos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Producto, Categoria, Movimiento])],
  controllers: [ProductosController],
  providers: [ProductosService, RolesGuard],
})
export class ProductosModule {}
