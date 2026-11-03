/**
 * Enumeraciones del dominio. Los valores coinciden con los enums de prisma/schema.prisma.
 */

export const Rol = {
  ADMIN: 'ADMIN',
  OPERACIONES: 'OPERACIONES',
  FINANZAS: 'FINANZAS',
  LECTURA: 'LECTURA',
} as const;
export type Rol = (typeof Rol)[keyof typeof Rol];

export const ROL_ETIQUETA: Record<Rol, string> = {
  ADMIN: 'Administrador',
  OPERACIONES: 'Operaciones',
  FINANZAS: 'Finanzas',
  LECTURA: 'Solo lectura',
};

export const TipoConductor = {
  TRABAJADOR: 'TRABAJADOR',
  TERCERO: 'TERCERO',
} as const;
export type TipoConductor = (typeof TipoConductor)[keyof typeof TipoConductor];

export const EstadoOrdenRetiro = {
  ABIERTA: 'ABIERTA',
  CON_CARGA: 'CON_CARGA',
  CERRADA: 'CERRADA',
  ANULADA: 'ANULADA',
} as const;
export type EstadoOrdenRetiro = (typeof EstadoOrdenRetiro)[keyof typeof EstadoOrdenRetiro];

export const EstadoOrdenCarga = {
  ABIERTA: 'ABIERTA',
  RENDIDA: 'RENDIDA',
  ANULADA: 'ANULADA',
} as const;
export type EstadoOrdenCarga = (typeof EstadoOrdenCarga)[keyof typeof EstadoOrdenCarga];

export const EstadoDocumento = {
  EMITIDO: 'EMITIDO',
  ANULADO: 'ANULADO',
} as const;
export type EstadoDocumento = (typeof EstadoDocumento)[keyof typeof EstadoDocumento];

export type Estado = EstadoOrdenRetiro | EstadoOrdenCarga | EstadoDocumento;

/** Rendición de un flete (con orden de carga) o de una estadía; comparten correlativo. */
export const TipoRendicion = {
  FLETE: 'FLETE',
  ESTADIA: 'ESTADIA',
} as const;
export type TipoRendicion = (typeof TipoRendicion)[keyof typeof TipoRendicion];

export const TIPO_RENDICION_ETIQUETA: Record<TipoRendicion, string> = {
  FLETE: 'Flete',
  ESTADIA: 'Estadía',
};

/** Origen de una estadía en la hoja de ruta; su destino es el lugar donde se hizo. */
export const ORIGEN_ESTADIA = 'ESTADÍA';

export const ESTADO_ETIQUETA: Record<Estado, string> = {
  ABIERTA: 'Abierta',
  CON_CARGA: 'Con carga',
  CERRADA: 'Cerrada',
  ANULADA: 'Anulada',
  RENDIDA: 'Rendida',
  EMITIDO: 'Emitido',
  ANULADO: 'Anulado',
};

/** Estados en que una orden de retiro admite documentos hijos ("activa"). */
export const ESTADOS_RETIRO_ACTIVOS: readonly EstadoOrdenRetiro[] = ['ABIERTA', 'CON_CARGA'];
