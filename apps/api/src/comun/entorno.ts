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
  /** Clave de la API de fm-track (GPS de los camiones). Sin ella no se muestran recorridos. */
  FM_TRACK_API_KEY: string;
  FM_TRACK_BASE_URL: string;
  /** Grupos de fm-track con los camiones de la empresa (nombre o id, separados por coma). */
  FM_TRACK_GRUPO: string;
  /** Captura de posiciones cada minuto para el historial (false para apagarla). */
  GPS_CAPTURA: boolean;
  /** Días que se guardan las posiciones capturadas. */
  GPS_RETENCION_DIAS: number;
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
    FM_TRACK_API_KEY: String(config['FM_TRACK_API_KEY'] ?? '').trim(),
    FM_TRACK_BASE_URL: String(
      config['FM_TRACK_BASE_URL'] || 'https://api.fm-track.com',
    ),
    FM_TRACK_GRUPO: String(config['FM_TRACK_GRUPO'] ?? '').trim(),
    GPS_CAPTURA:
      String(config['GPS_CAPTURA'] ?? 'true').toLowerCase() !== 'false' &&
      nodeEnv !== 'test',
    GPS_RETENCION_DIAS: Math.max(
      31,
      Number(config['GPS_RETENCION_DIAS'] ?? 40) || 40,
    ),
  };
}
