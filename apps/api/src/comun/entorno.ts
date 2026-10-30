/**
 * Variables de entorno requeridas por la API. Falla al arrancar si falta alguna.
 */
export interface Entorno {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_TTL: string;
  JWT_REFRESH_TTL_DIAS: number;
  CORS_ORIGIN: string;
  /** strict (web y API en el mismo sitio), lax, o none si la web está en otro sitio (exige HTTPS). */
  COOKIE_SAMESITE: 'strict' | 'lax' | 'none';
}

export function validarEntorno(config: Record<string, unknown>): Entorno {
  const faltantes = [
    'DATABASE_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
  ].filter((k) => !config[k]);
  if (faltantes.length) {
    throw new Error(
      `Faltan variables de entorno: ${faltantes.join(', ')}. Revise el archivo .env (ver .env.example).`,
    );
  }
  const nodeEnv = (config['NODE_ENV'] as Entorno['NODE_ENV']) ?? 'development';
  const sameSite = String(config['COOKIE_SAMESITE'] ?? 'strict').toLowerCase();
  if (!['strict', 'lax', 'none'].includes(sameSite)) {
    throw new Error('COOKIE_SAMESITE debe ser strict, lax o none.');
  }
  if (nodeEnv === 'production') {
    for (const k of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
      const v = String(config[k]);
      if (v.length < 32 || v.startsWith('cambiar-en-produccion')) {
        throw new Error(
          `${k} debe ser un secreto aleatorio de al menos 32 caracteres en producción.`,
        );
      }
    }
  }
  return {
    NODE_ENV: nodeEnv,
    PORT: Number(config['PORT'] ?? 3100),
    DATABASE_URL: String(config['DATABASE_URL']),
    JWT_ACCESS_SECRET: String(config['JWT_ACCESS_SECRET']),
    JWT_REFRESH_SECRET: String(config['JWT_REFRESH_SECRET']),
    JWT_ACCESS_TTL: String(config['JWT_ACCESS_TTL'] ?? '15m'),
    JWT_REFRESH_TTL_DIAS: Number(config['JWT_REFRESH_TTL_DIAS'] ?? 7),
    CORS_ORIGIN: String(config['CORS_ORIGIN'] ?? ''),
    COOKIE_SAMESITE: sameSite as Entorno['COOKIE_SAMESITE'],
  };
}
