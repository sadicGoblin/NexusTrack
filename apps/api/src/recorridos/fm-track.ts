import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Punto } from './analisis.js';

/** Vehículo en el GPS. El nombre suele llevar la patente: "CDSP97, Luis Gaete". */
export interface VehiculoGps {
  id: string;
  nombre: string;
  patente: string | null;
}

const POR_PAGINA = 1000;
const MAX_PAGINAS = 40;
const ESPERAS_429 = [1500, 3000, 6000];
/** La lista de vehículos cambia poco: se relee cada 10 minutos. */
const VIGENCIA_VEHICULOS = 10 * 60_000;

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Solo letras y números en mayúscula: "CD-SP 97" → "CDSP97". */
export const normalizarPatente = (texto: string) =>
  texto.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Busca la patente en la patente oficial o en cualquier parte del nombre (antes de una coma, etc.). */
export function coincidePatente(v: VehiculoGps, patente: string): boolean {
  const buscada = normalizarPatente(patente);
  if (!buscada) return false;
  const candidatos = [v.patente ?? '', ...v.nombre.split(/[,;|/()]/)];
  return (
    candidatos.some((c) => normalizarPatente(c) === buscada) ||
    normalizarPatente(v.nombre).startsWith(buscada)
  );
}

/** Posiciones de fm-track a puntos ordenados por tiempo, sin duplicados ni coordenadas inválidas. */
export function aPuntos(items: unknown[]): Punto[] {
  const puntos: Punto[] = [];
  for (const it of items as Record<string, any>[]) {
    const pos = it?.['position'] ?? {};
    const lat = Number(pos.latitude);
    const lng = Number(pos.longitude);
    const t = Date.parse(it?.['datetime']);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(t))
      continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0))
      continue;
    const velocidad = Number(pos.speed);
    const odometro = Number(it?.['calculated_inputs']?.mileage);
    const encendido = it?.['ignition_status'];
    puntos.push({
      t,
      lat,
      lng,
      velocidad: Number.isFinite(velocidad) && velocidad >= 0 ? velocidad : 0,
      encendido: encendido === 'ON' ? 1 : encendido === 'OFF' ? 0 : null,
      odometro: Number.isFinite(odometro) ? odometro : null,
    });
  }
  puntos.sort((a, b) => a.t - b.t);
  return puntos.filter((p, i) => i === 0 || puntos[i - 1]!.t !== p.t);
}

/**
 * Cliente de la API de fm-track (Ruptela), el GPS de los camiones. Solo lee: lista de vehículos y
 * posiciones históricas. Documentación: https://api.fm-track.com/swagger-ui.html
 */
@Injectable()
export class FmTrackService {
  private readonly logger = new Logger(FmTrackService.name);
  private readonly clave: string;
  private readonly base: string;
  private vehiculos?: { leidos: number; lista: VehiculoGps[] };

  constructor(config: ConfigService) {
    this.clave = config.get<string>('FM_TRACK_API_KEY') ?? '';
    this.base = (
      config.get<string>('FM_TRACK_BASE_URL') ?? 'https://api.fm-track.com'
    ).replace(/\/$/, '');
  }

  get configurado(): boolean {
    return !!this.clave;
  }

  private async llamar(ruta: string, parametros: Record<string, string> = {}) {
    if (!this.clave)
      throw new ServiceUnavailableException(
        'El GPS no está configurado en el servidor (falta la clave de fm-track).',
      );
    const url = new URL(`${this.base}${ruta}`);
    // Como en la plataforma de integraciones: la clave va en la consulta y en el encabezado.
    url.search = new URLSearchParams({
      version: '1',
      ...parametros,
      api_key: this.clave,
    }).toString();
    for (let intento = 0; ; intento++) {
      let r: Response;
      try {
        r = await fetch(url, {
          headers: { Accept: 'application/json', 'X-Api-Key': this.clave },
          signal: AbortSignal.timeout(20_000),
        });
      } catch (error) {
        this.logger.warn(`fm-track ${ruta}: ${String(error)}`);
        throw new BadGatewayException(
          'El GPS no respondió. Intente de nuevo en unos minutos.',
        );
      }
      // fm-track limita las consultas seguidas: se reintenta con espera creciente.
      if (r.status === 429 && intento < ESPERAS_429.length) {
        await esperar(ESPERAS_429[intento]!);
        continue;
      }
      if (!r.ok) {
        this.logger.warn(`fm-track ${ruta}: HTTP ${r.status}`);
        throw new BadGatewayException(
          r.status === 401 || r.status === 403
            ? 'El GPS rechazó la clave de acceso configurada.'
            : `El GPS respondió con un error (HTTP ${r.status}).`,
        );
      }
      return (await r.json()) as unknown;
    }
  }

  private async listarVehiculos(): Promise<VehiculoGps[]> {
    if (
      this.vehiculos &&
      Date.now() - this.vehiculos.leidos < VIGENCIA_VEHICULOS
    )
      return this.vehiculos.lista;
    const datos = await this.llamar('/objects');
    const items = (
      Array.isArray(datos) ? datos : ((datos as any)?.items ?? [])
    ) as Record<string, any>[];
    const lista = items.map((o) => ({
      id: String(o['id']),
      nombre: String(o['name'] ?? ''),
      patente: o['vehicle_params']?.plate_number ?? null,
    }));
    this.vehiculos = { leidos: Date.now(), lista };
    return lista;
  }

  async buscarVehiculo(patente: string): Promise<VehiculoGps | null> {
    return (
      (await this.listarVehiculos()).find((v) => coincidePatente(v, patente)) ??
      null
    );
  }

  /** Posiciones entre dos instantes, leídas por páginas de 1.000 (hasta 40.000). */
  async posiciones(
    vehiculoId: string,
    desde: Date,
    hasta: Date,
  ): Promise<{ puntos: Punto[]; truncado: boolean }> {
    const items: unknown[] = [];
    let token: string | null = null;
    for (let pagina = 1; ; pagina++) {
      const datos = (await this.llamar(
        `/objects/${encodeURIComponent(vehiculoId)}/coordinates`,
        {
          fromDatetime: desde.toISOString(),
          toDatetime: hasta.toISOString(),
          limit: String(POR_PAGINA),
          ...(token ? { continuationToken: token } : {}),
        },
      )) as Record<string, any>;
      const lote = (datos?.['items'] ?? datos ?? []) as unknown[];
      items.push(...(Array.isArray(lote) ? lote : []));
      const siguiente =
        datos?.['continuation_token'] ?? datos?.['continuationToken'] ?? null;
      if (!siguiente || !lote.length || String(siguiente) === token)
        return { puntos: aPuntos(items), truncado: false };
      if (pagina >= MAX_PAGINAS)
        return { puntos: aPuntos(items), truncado: true };
      token = String(siguiente);
    }
  }
}
