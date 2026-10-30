import type { ColumnaExportacion, TipoColumna } from '@nexustrack/shared';

export interface CampoImprimible {
  etiqueta: string;
  valor: unknown;
  tipo?: TipoColumna;
  /** Columnas que ocupa en una grilla de 4 (por defecto 1). */
  ancho?: 1 | 2 | 3 | 4;
}

export interface SeccionImprimible {
  titulo?: string;
  campos: CampoImprimible[];
}

export interface TablaImprimible {
  titulo?: string;
  columnas: ColumnaExportacion[];
  filas: Record<string, unknown>[];
  totales?: { etiqueta: string; valor: unknown; tipo?: TipoColumna }[];
}

/** Descripción de un documento que se puede exportar a PDF o Excel con el mismo contenido. */
export interface DocumentoImprimible {
  titulo: string;
  numero: number;
  fecha: string | null;
  estado: string;
  anulado?: { motivo: string | null };
  secciones: SeccionImprimible[];
  tablas: TablaImprimible[];
  observaciones?: string | null;
  firmas?: string[];
  nombreArchivo: string;
}

export interface DatosEmisor {
  nombre: string;
  rut: string;
  direccion: string;
  telefono: string;
  email: string;
}

export interface ArchivoGenerado {
  contenido: Buffer;
  tipo: string;
  nombre: string;
}
