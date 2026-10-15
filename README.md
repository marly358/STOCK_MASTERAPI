# StockMaster API

API de inventario construida con NestJS 11, TypeORM 0.3 y MySQL. Incluye
las entidades compartidas `Usuario`, `Categoria`, `Producto` y `Movimiento`,
registro e inicio de sesión JWT, y el endpoint protegido `GET /usuarios/yo`.

## Configuración

1. Instala Node.js 20 o superior y MySQL.
2. Ejecuta `npm install`.
3. Copia `.env.example` a `.env` y configura la conexión MySQL.
4. Sustituye `JWT_SECRET` por un secreto propio de al menos 32 caracteres.
5. En desarrollo, define `NODE_ENV=development` para permitir
   `DB_SINCRONIZAR=true`. La sincronización está desactivada fuera de
   desarrollo; no se usa `dropSchema`.

La aplicación valida las variables al iniciar y muestra el nombre de la
variable faltante o inválida, nunca su valor secreto.

## Scripts

```bash
npm run start:dev
npm run build
npm run start:prod
npm test
npm run test:e2e
npm run lint
```

La documentación Swagger se sirve en `/api/docs`.

## Autenticación

- `POST /auth/registro`: recibe `correo` y `contrasena`; crea usuarios con rol
  `CONSULTOR`. El cuerpo no admite un campo `rol`.
- `POST /auth/login`: recibe `correo` y `contrasena`; responde con `accessToken`.
- `GET /usuarios/yo`: requiere `Authorization: Bearer <token>`.

Las respuestas de usuario y los JWT nunca contienen el hash de contraseña. El
usuario autenticado queda disponible mediante `@CurrentUser()` y expone `id` y
`rol`. `@Roles()` y `RolesGuard` aplican los permisos sobre la identidad
validada por la estrategia JWT; una solicitud no autenticada recibe `401` y
una solicitud autenticada sin permiso recibe `403`.

## Permisos

| Recurso | Operación | Permiso |
| --- | --- | --- |
| Usuarios | Registro y login | Público |
| Usuarios | Consultar la identidad propia | Cualquier usuario autenticado |
| Categorías | Listar y consultar | Cualquier usuario autenticado |
| Categorías | Crear, actualizar y eliminar | `ADMIN` |
| Movimientos | Historial y consulta por ID | Cualquier usuario autenticado |
| Movimientos | Registrar entradas y salidas | `BODEGUERO` |

Los endpoints de productos aún no están incorporados en esta rama; cuando se
integre ese módulo deberá aplicarse allí la matriz acordada (`ADMIN` y
`BODEGUERO` para crear, cualquier usuario autenticado para consultar y solo
`ADMIN` para actualizar o eliminar).

## Movimientos de inventario

El módulo `src/movimientos` registra y consulta movimientos sobre la entidad
compartida `Movimiento`:

- `POST /movimientos/entradas` y `POST /movimientos/salidas`: registran el
  movimiento con la ruta (el cuerpo no admite el campo `tipo`). Solo
  `BODEGUERO`; el cuerpo recibe `productoId` y `cantidad`. El responsable se
  toma del JWT y la fecha se genera en el servidor.
- `GET /movimientos`: historial (cualquier rol autenticado) con filtros
  opcionales `productoId`, `desde` y `hasta` (aceptan `YYYY-MM-DD` o ISO 8601;
  un día sin hora cubre toda la jornada).
- `GET /movimientos/:id`: consulta por ID.

La creación del movimiento y la actualización del stock ocurren en una única
transacción con `DataSource` y `QueryRunner`: la fila del producto se bloquea
con `SELECT ... FOR UPDATE` y el stock se modifica con una actualización
condicional que solo descuenta si sigue habiendo stock y solo suma si no
desborda la columna. Si no hay stock (409) o el producto no existe (404), no
se inserta nada; si la escritura del movimiento falla, se revierte todo. Los
movimientos no tienen endpoints de edición o borrado.

## Pruebas

`npm run test:e2e` ejecuta pruebas HTTP con un repositorio de usuario en memoria
y servicios de categorías y movimientos simulados; no requiere MySQL ni
modifica datos de desarrollo. Estas pruebas ejercitan autenticación,
autorización por rol, validación de DTO y la especificación Swagger. La
aplicación normal sí requiere un servidor MySQL configurado en `.env`.

Las pruebas de integración de movimientos contra MySQL real (`test/movimientos.mysql.e2e-spec.ts`)
están deshabilitadas por defecto porque usan una base dedicada
(`stockmaster_test`) que limpian al arrancar. Actívalas con:

```bash
DB_TEST_MYSQL=1 npm run test:e2e
```

Opcionales: `DB_TEST_HOST`, `DB_TEST_PORT`, `DB_TEST_USER`, `DB_TEST_PASSWORD`
y `DB_TEST_NOMBRE`. Cubren transacciones, rollback real, bloqueo pesimista y
concurrencia real sobre InnoDB.

## Entidades compartidas

Las entidades y enums viven en `src/entidades`. Reutilízalos desde los módulos
funcionales; hoy el proyecto incluye el módulo de categorías y el módulo de
movimientos, que reutilizan `Usuario`, `Categoria`, `Producto` y `Movimiento`
sin duplicarlos.
