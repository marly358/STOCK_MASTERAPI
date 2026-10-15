import { ApiProperty } from '@nestjs/swagger';
import { Rol } from '../entidades/rol.enum';
import { TipoMovimiento } from '../entidades/tipo-movimiento.enum';

/**
 * Responsable del movimiento. Expone solo los datos públicos del usuario
 * autenticado; nunca el hash de contraseña.
 */
export class UsuarioMovimiento {
  @ApiProperty({ description: 'Identificador del usuario responsable' })
  id!: number;

  @ApiProperty({ description: 'Correo del usuario responsable' })
  correo!: string;

  @ApiProperty({ enum: Rol, description: 'Rol del usuario responsable' })
  rol!: Rol;
}

/** Producto afectado por el movimiento, en su versión pública. */
export class ProductoMovimiento {
  @ApiProperty({ description: 'Identificador del producto' })
  id!: number;

  @ApiProperty({ description: 'Nombre del producto' })
  nombre!: string;
}

/** Representación pública de un movimiento de inventario. */
export class MovimientoRespuesta {
  @ApiProperty({ description: 'Identificador del movimiento' })
  id!: number;

  @ApiProperty({ enum: TipoMovimiento, description: 'Tipo de movimiento' })
  tipo!: TipoMovimiento;

  @ApiProperty({ description: 'Cantidad registrada' })
  cantidad!: number;

  @ApiProperty({
    description: 'Fecha y hora generadas por el servidor',
    type: String,
    format: 'date-time',
  })
  fecha!: Date;

  @ApiProperty({ type: ProductoMovimiento, description: 'Producto afectado' })
  producto!: ProductoMovimiento;

  @ApiProperty({
    type: UsuarioMovimiento,
    description: 'Usuario responsable tomado del JWT',
  })
  usuario!: UsuarioMovimiento;
}
