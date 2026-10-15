import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movimiento } from '../entidades/movimiento.entity';
import { MovimientosController } from './movimientos.controller';
import { MovimientosService } from './movimientos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Movimiento])],
  controllers: [MovimientosController],
  providers: [MovimientosService],
})
export class MovimientosModule {}
