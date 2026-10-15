export type JwtExpiration = `${number}${'s' | 'm' | 'h' | 'd'}`;

export interface AppEnvironment {
  PUERTO: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_USUARIO: string;
  DB_CONTRASENA: string;
  DB_NOMBRE: string;
  JWT_SECRET: string;
  JWT_EXPIRACION: JwtExpiration;
  DB_SINCRONIZAR: boolean;
  NODE_ENV?: string;
}

function requiredString(env: Record<string, unknown>, name: string): string {
  const value = env[name];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`La variable de entorno ${name} es obligatoria.`);
  }
  return value.trim();
}

function requiredPassword(env: Record<string, unknown>): string {
  const value = env.DB_CONTRASENA;
  if (typeof value !== 'string') {
    throw new Error('La variable de entorno DB_CONTRASENA es obligatoria.');
  }
  return value;
}

function positiveInteger(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(
      `La variable de entorno ${name} debe ser un entero positivo.`,
    );
  }
  return parsed;
}

function parseJwtExpiration(value: string): JwtExpiration {
  if (!/^[1-9]\d*[smhd]$/.test(value)) {
    throw new Error(
      'La variable de entorno JWT_EXPIRACION tiene un formato inválido.',
    );
  }
  return value as JwtExpiration;
}

export function validateEnvironment(
  env: Record<string, unknown>,
): AppEnvironment {
  const jwtSecret = requiredString(env, 'JWT_SECRET');
  if (
    jwtSecret.length < 32 ||
    jwtSecret === 'REEMPLAZAR_POR_UN_SECRETO_SEGURO'
  ) {
    throw new Error(
      'La variable de entorno JWT_SECRET debe tener al menos 32 caracteres seguros.',
    );
  }

  const synchronizeValue = env.DB_SINCRONIZAR;
  if (synchronizeValue !== 'true' && synchronizeValue !== 'false') {
    throw new Error(
      'La variable de entorno DB_SINCRONIZAR debe ser true o false.',
    );
  }

  const nodeEnv = env.NODE_ENV;
  if (
    nodeEnv !== undefined &&
    nodeEnv !== 'development' &&
    nodeEnv !== 'production' &&
    nodeEnv !== 'test'
  ) {
    throw new Error(
      'La variable de entorno NODE_ENV debe ser development, test o production.',
    );
  }

  return {
    PUERTO: positiveInteger(requiredString(env, 'PUERTO'), 'PUERTO'),
    DB_HOST: requiredString(env, 'DB_HOST'),
    DB_PORT: positiveInteger(requiredString(env, 'DB_PORT'), 'DB_PORT'),
    DB_USUARIO: requiredString(env, 'DB_USUARIO'),
    DB_CONTRASENA: requiredPassword(env),
    DB_NOMBRE: requiredString(env, 'DB_NOMBRE'),
    JWT_SECRET: jwtSecret,
    JWT_EXPIRACION: parseJwtExpiration(requiredString(env, 'JWT_EXPIRACION')),
    DB_SINCRONIZAR: synchronizeValue === 'true',
    ...(typeof nodeEnv === 'string' ? { NODE_ENV: nodeEnv } : {}),
  };
}
