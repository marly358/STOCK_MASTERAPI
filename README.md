# StockMaster API

API base de inventario construida con NestJS 11, TypeORM 0.3 y MySQL. Incluye
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
`rol` para que los módulos futuros puedan implementar autorización.

## Pruebas

`npm run test:e2e` ejecuta pruebas HTTP con un repositorio de usuario en memoria;
no requiere MySQL ni modifica datos de desarrollo. La aplicación normal sí
requiere un servidor MySQL configurado en `.env`.

## Entidades compartidas

Las entidades y enums viven en `src/entidades`. Reutilízalos desde los módulos
funcionales futuros; esta base no implementa servicios ni controladores de
categorías, productos o movimientos.
