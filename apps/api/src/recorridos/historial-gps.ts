import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EstadoGpsDto } from '@nexustrack/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Punto } from './analisis.js';
import { FmTrackService, type VehiculoGps } from './fm-track.js';

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const CADA = MINUTO;
/** Cada vuelta relee unos minutos ya consultados: el equipo sube con atraso lo que guardó sin señal. */
const MARGEN = 10 * MINUTO;
/** Una vez por hora se relee más atrás, por las subidas más atrasadas (túneles, zonas sin señal). */
const REVISION = 6 * HORA;
/** Un vehículo sin nada guardado parte con la última hora; tras una caída, se recupera hasta 7 días. */
const INICIO = HORA;
const RECUPERACION = 7 * 24 * HORA;
/** Consultas simultáneas a fm-track: más provoca respuestas 429. */
const SIMULTANEAS = 4;

/** Desde cuándo pedir posiciones a un vehículo en esta vuelta. */
export function inicioVentana(
  consultadoHasta: number | undefined,
  ahora: number,
  revision: boolean,
): number {
  const desde =
    consultadoHasta === undefined
      ? ahora - INICIO
      : Math.max(consultadoHasta - MARGEN, ahora - RECUPERACION);
  return revision ? Math.min(desde, ahora - REVISION) : desde;
}

/** Ejecuta `fn` sobre la lista con a lo más `limite` llamadas en curso. */
async function enParalelo<T>(
  lista: T[],
  limite: number,
  fn: (x: T) => Promise<void>,
): Promise<void> {
  let siguiente = 0;
  await Promise.all(
    Array.from({ length: Math.min(limite, lista.length) }, async () => {
      while (siguiente < lista.length) await fn(lista[siguiente++]!);
    }),
  );
}

/** Posiciones guardadas en la base (tabla PosicionGps). */
@Injectable()
export class HistorialGpsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Guarda los puntos nuevos; los repetidos (misma hora) se ignoran. Devuelve cuántos guardó. */
  async guardar(vehiculoId: string, puntos: Punto[]): Promise<number> {
    let guardadas = 0;
    for (let i = 0; i < puntos.length; i += 1000) {
      const r = await this.prisma.posicionGps.createMany({
        data: puntos.slice(i, i + 1000).map((p) => ({
          vehiculoId,
          fecha: new Date(p.t),
          lat: p.lat,
          lng: p.lng,
          velocidad: p.velocidad,
          encendido: p.encendido,
          odometro: p.odometro,
        })),
        skipDuplicates: true,
      });
      guardadas += r.count;
    }
    return guardadas;
  }

  async leer(vehiculoId: string, desde: Date, hasta: Date): Promise<Punto[]> {
    const filas = await this.prisma.posicionGps.findMany({
      where: { vehiculoId, fecha: { gte: desde, lte: hasta } },
      orderBy: { fecha: 'asc' },
    });
    return filas.map((f) => ({
      t: f.fecha.getTime(),
      lat: f.lat,
      lng: f.lng,
      velocidad: f.velocidad ?? 0,
      encendido: f.encendido === 1 ? 1 : f.encendido === 0 ? 0 : null,
      odometro: f.odometro,
    }));
  }

  /** Primera posición guardada del vehículo: antes de ella hay que preguntarle al GPS. */
  async primera(vehiculoId: string): Promise<Date | null> {
    const r = await this.prisma.posicionGps.aggregate({
      where: { vehiculoId },
      _min: { fecha: true },
    });
    return r._min.fecha;
  }

  /** Última posición guardada de cada vehículo. */
  async ultimas(): Promise<Map<string, number>> {
    const filas = await this.prisma.posicionGps.groupBy({
      by: ['vehiculoId'],
      _max: { fecha: true },
    });
    return new Map(
      filas.map((f) => [f.vehiculoId, f._max.fecha?.getTime() ?? 0]),
    );
  }

  async borrarAnteriores(fecha: Date): Promise<number> {
    return (
      await this.prisma.posicionGps.deleteMany({
        where: { fecha: { lt: fecha } },
      })
    ).count;
  }

  async resumen(): Promise<{ posiciones: number; desde: Date | null }> {
    const r = await this.prisma.posicionGps.aggregate({
      _count: true,
      _min: { fecha: true },
    });
    return { posiciones: r._count, desde: r._min.fecha };
  }
}

/**
 * Captura cada minuto las posiciones de los camiones del grupo de fm-track, como la plataforma
 * de integraciones: así el recorrido de una rendición sale de la base, con al menos los días de
 * GPS_RETENCION_DIAS hacia atrás, sin consultar el GPS cada vez. Apagada en pruebas, sin clave
 * de fm-track o con GPS_CAPTURA=false.
 */
@Injectable()
export class CapturaGpsService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger('CapturaGps');
  private readonly activa: boolean;
  private readonly retencionDias: number;
  private reloj?: NodeJS.Timeout;
  private enCurso = false;
  /** Hasta cuándo se consultó cada vehículo (no la última posición: un camión detenido no informa). */
  private readonly consultado = new Map<string, number>();
  private ultimaRevision = 0;
  private ultimaLimpieza = 0;
  private guardadasHora = 0;
  private readonly avisos = new Map<string, number>();
  private estadoActual: Pick<
    EstadoGpsDto,
    'vehiculos' | 'ultimaCaptura' | 'ultimoError'
  > = { vehiculos: 0, ultimaCaptura: null, ultimoError: null };

  constructor(
    private readonly historial: HistorialGpsService,
    private readonly gps: FmTrackService,
    config: ConfigService,
  ) {
    this.activa = !!config.get<boolean>('GPS_CAPTURA') && gps.configurado;
    this.retencionDias = config.get<number>('GPS_RETENCION_DIAS') ?? 40;
  }

  onApplicationBootstrap(): void {
    if (!this.activa) return;
    this.reloj = setInterval(() => void this.capturar(), CADA);
    this.reloj.unref();
    void this.capturar();
  }

  onModuleDestroy(): void {
    clearInterval(this.reloj);
  }

  async estado(): Promise<EstadoGpsDto> {
    const { posiciones, desde } = await this.historial.resumen();
    return {
      configurado: this.gps.configurado,
      grupos: this.gps.grupos,
      capturando: this.activa,
      retencionDias: this.retencionDias,
      ...this.estadoActual,
      posiciones,
      desde: desde?.toISOString() ?? null,
    };
  }

  /** Una vuelta de captura; si la anterior no terminó, se salta. */
  async capturar(): Promise<void> {
    if (this.enCurso) return;
    this.enCurso = true;
    const ahora = Date.now();
    try {
      const vehiculos = await this.gps.listarVehiculos();
      if (!this.estadoActual.ultimaCaptura) {
        for (const [id, t] of await this.historial.ultimas())
          this.consultado.set(id, t);
        this.logger.log(
          `Capturando posiciones de ${vehiculos.length} vehículos${this.gps.grupos.length ? ` del grupo ${this.gps.grupos.join(', ')}` : ''} cada minuto.`,
        );
      }
      const revision = ahora - this.ultimaRevision >= HORA;
      const fallas: string[] = [];
      await enParalelo(vehiculos, SIMULTANEAS, (v) =>
        this.capturarVehiculo(v, ahora, revision).catch((e: unknown) => {
          fallas.push(`${v.nombre}: ${e instanceof Error ? e.message : e}`);
        }),
      );
      this.estadoActual = {
        vehiculos: vehiculos.length,
        ultimaCaptura: new Date(ahora).toISOString(),
        ultimoError: fallas[0] ?? null,
      };
      if (fallas.length)
        this.avisar(
          'vehiculos',
          `${fallas.length} de ${vehiculos.length} vehículos sin capturar (${fallas[0]}).`,
        );
      if (revision) {
        if (this.ultimaRevision)
          this.logger.log(
            `${this.guardadasHora} posiciones guardadas en la última hora.`,
          );
        this.ultimaRevision = ahora;
        this.guardadasHora = 0;
      }
      if (ahora - this.ultimaLimpieza >= 6 * HORA) {
        const borradas = await this.historial.borrarAnteriores(
          new Date(ahora - this.retencionDias * 24 * HORA),
        );
        this.ultimaLimpieza = ahora;
        if (borradas)
          this.logger.log(
            `${borradas} posiciones de más de ${this.retencionDias} días borradas.`,
          );
      }
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      this.estadoActual = { ...this.estadoActual, ultimoError: mensaje };
      this.avisar('captura', `Captura fallida: ${mensaje}`);
    } finally {
      this.enCurso = false;
    }
  }

  private async capturarVehiculo(
    v: VehiculoGps,
    ahora: number,
    revision: boolean,
  ): Promise<void> {
    const desde = inicioVentana(this.consultado.get(v.id), ahora, revision);
    const { puntos } = await this.gps.posiciones(
      v.id,
      new Date(desde),
      new Date(ahora),
    );
    this.guardadasHora += await this.historial.guardar(v.id, puntos);
    this.consultado.set(v.id, ahora);
  }

  /** Avisos al registro: cada tipo a lo más una vez cada 10 minutos, para no llenarlo. */
  private avisar(tipo: string, mensaje: string): void {
    if (Date.now() - (this.avisos.get(tipo) ?? 0) < 10 * MINUTO) return;
    this.avisos.set(tipo, Date.now());
    this.logger.warn(mensaje);
  }
}
