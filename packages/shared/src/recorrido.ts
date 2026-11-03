/**
 * Recorrido GPS de un camión entre dos momentos (salida y llegada de la rendición). Solo
 * historial: lo entrega el proveedor GPS y la API lo resume en viajes y paradas.
 */

/** Momento en hora de Chile: "AAAA-MM-DDTHH:mm". */
export interface FiltroRecorrido {
  patente: string;
  desde: string;
  hasta: string;
}

export interface Coordenada {
  lat: number;
  lng: number;
}

export interface ResumenRecorridoDto {
  /** Kilómetros en movimiento según las posiciones GPS. */
  distanciaKm: number;
  /** Kilómetros según el odómetro del equipo GPS, si lo informa. */
  odometroKm: number | null;
  movimientoSeg: number;
  detenidoSeg: number;
  velocidadMax: number;
  velocidadPromedio: number;
  viajes: number;
  paradas: number;
  puntos: number;
  /** Primera y última posición (ISO UTC). */
  primero: string | null;
  ultimo: string | null;
}

/** Tramo en movimiento entre dos paradas. Horas en ISO UTC. */
export interface ViajeRecorridoDto {
  inicio: string;
  fin: string;
  duracionSeg: number;
  movimientoSeg: number;
  distanciaKm: number;
  odometroKm: number | null;
  velocidadMax: number;
  velocidadPromedio: number;
  desde: Coordenada;
  hasta: Coordenada;
}

/** Detención de al menos 5 minutos. */
export interface ParadaRecorridoDto extends Coordenada {
  inicio: string;
  fin: string;
  duracionSeg: number;
  /** El motor estuvo apagado la mayor parte de la parada. */
  motorApagado: boolean;
}

export interface RecorridoDto {
  patente: string;
  /** Nombre del vehículo en el GPS. */
  vehiculo: string;
  desde: string;
  hasta: string;
  resumen: ResumenRecorridoDto;
  viajes: ViajeRecorridoDto[];
  paradas: ParadaRecorridoDto[];
  /** Polilínea simplificada: [lat, lng, segundos desde 1970, velocidad]. */
  ruta: [number, number, number, number][];
  /** El GPS entregó más posiciones de las que se leen en una consulta. */
  truncado: boolean;
  /**
   * De dónde salieron las posiciones: guardadas por la captura de cada minuto, pedidas al GPS
   * (período anterior a lo guardado) o ambas.
   */
  fuente: 'local' | 'gps' | 'mixta';
}

/** Estado de la captura de posiciones (diagnóstico). */
export interface EstadoGpsDto {
  configurado: boolean;
  grupos: string[];
  capturando: boolean;
  retencionDias: number;
  vehiculos: number;
  /** Última vuelta de captura (ISO UTC). */
  ultimaCaptura: string | null;
  ultimoError: string | null;
  posiciones: number;
  /** Posición más antigua guardada. */
  desde: string | null;
}
