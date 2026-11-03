import {
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type {
  EstadoGpsDto,
  FiltroRecorrido,
  RecorridoDto,
  VehiculoGpsDto,
} from '@nexustrack/shared';
import { invalido } from '../comun/errores.js';
import { chileAUtc } from '../comun/fechas.js';
import { FechaHora, Texto } from '../comun/validacion.js';
import { analizarRecorrido, type Punto } from './analisis.js';
import { FmTrackService } from './fm-track.js';
import { CapturaGpsService, HistorialGpsService } from './historial-gps.js';

class FiltroRecorridoDto implements FiltroRecorrido {
  @Texto('Patente', { opcional: true, max: 12, mayusculas: true })
  patente?: string;
  @Texto('Unidad', { opcional: true, max: 64 }) vehiculoId?: string;
  @FechaHora('Salida') desde!: string;
  @FechaHora('Llegada') hasta!: string;
}

/** Un mes: lo que alcanza a guardar el historial (GPS_RETENCION_DIAS, mínimo 31). */
const MAX_DIAS = 31;
const VIGENCIA_CACHE = 5 * 60_000;
const MAX_CACHE = 50;

/** Une posiciones de dos fuentes por hora, sin repetir. */
function mezclar(a: Punto[], b: Punto[]): Punto[] {
  const porHora = new Map<number, Punto>();
  for (const p of [...a, ...b]) if (!porHora.has(p.t)) porHora.set(p.t, p);
  return [...porHora.values()].sort((x, y) => x.t - y.t);
}

/**
 * Recorrido GPS de un camión entre la salida y la llegada de una rendición (solo historial). Sale
 * de las posiciones capturadas cada minuto; lo anterior a la primera guardada se pide una vez al
 * GPS y queda guardado. Las consultas recientes quedan en memoria unos minutos.
 */
@Injectable()
export class RecorridosService {
  private readonly cache = new Map<
    string,
    { creado: number; recorrido: RecorridoDto }
  >();

  /** Desde cuándo ya se le pidió al GPS cada vehículo (aunque no haya devuelto nada). */
  private readonly pedidoDesde = new Map<string, number>();

  constructor(
    private readonly gps: FmTrackService,
    private readonly historial: HistorialGpsService,
  ) {}

  async vehiculos() {
    return [...(await this.gps.listarVehiculos())].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es'),
    );
  }

  async obtener(f: FiltroRecorrido): Promise<RecorridoDto> {
    const desde = chileAUtc(f.desde);
    const hasta = new Date(Math.min(chileAUtc(f.hasta).getTime(), Date.now()));
    if (desde >= hasta)
      throw invalido(
        'La llegada debe ser posterior a la salida, y la salida anterior a este momento.',
      );
    if (hasta.getTime() - desde.getTime() > MAX_DIAS * 86_400_000)
      throw invalido(
        `El recorrido puede abarcar como máximo ${MAX_DIAS} días.`,
      );

    if (!f.patente === !f.vehiculoId)
      throw invalido('Indique la patente o la unidad del GPS.');
    const vehiculo = f.vehiculoId
      ? ((await this.gps.listarVehiculos()).find(
          (v) => v.id === f.vehiculoId,
        ) ?? null)
      : await this.gps.buscarVehiculo(f.patente!);
    if (!vehiculo)
      throw new NotFoundException(
        f.patente
          ? `El camión ${f.patente} no está registrado en el GPS.`
          : 'La unidad no está en el grupo del GPS.',
      );

    const clave = `${vehiculo.id}|${desde.toISOString()}|${hasta.toISOString()}`;
    const guardado = this.cache.get(clave);
    if (guardado && Date.now() - guardado.creado < VIGENCIA_CACHE)
      return guardado.recorrido;

    const guardadas = await this.historial.leer(vehiculo.id, desde, hasta);
    let puntos = guardadas;
    let truncado = false;
    let fuente: RecorridoDto['fuente'] = 'local';
    const cubiertoDesde = Math.min(
      (await this.historial.primera(vehiculo.id))?.getTime() ?? Infinity,
      this.pedidoDesde.get(vehiculo.id) ?? Infinity,
    );
    if (cubiertoDesde - desde.getTime() > 2 * 60_000) {
      const fin = new Date(Math.min(cubiertoDesde, hasta.getTime()));
      const r = await this.gps.posiciones(vehiculo.id, desde, fin);
      await this.historial.guardar(vehiculo.id, r.puntos);
      if (!r.truncado)
        this.pedidoDesde.set(
          vehiculo.id,
          Math.min(cubiertoDesde, desde.getTime()),
        );
      puntos = mezclar(r.puntos, guardadas);
      truncado = r.truncado;
      fuente = guardadas.length ? 'mixta' : 'gps';
    }
    const recorrido: RecorridoDto = {
      patente: f.patente ?? vehiculo.nombre,
      vehiculo: vehiculo.nombre,
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      ...analizarRecorrido(puntos),
      truncado,
      fuente,
    };
    this.cache.set(clave, { creado: Date.now(), recorrido });
    if (this.cache.size > MAX_CACHE)
      this.cache.delete(this.cache.keys().next().value!);
    return recorrido;
  }
}

@ApiTags('Recorridos GPS')
@Controller('recorridos')
export class RecorridosController {
  constructor(
    private readonly servicio: RecorridosService,
    private readonly captura: CapturaGpsService,
  ) {}

  /** Unidades del grupo del GPS, para elegir una en Trazabilidad. */
  @Get('vehiculos') async vehiculos(): Promise<VehiculoGpsDto[]> {
    return (await this.servicio.vehiculos()).map(({ id, nombre }) => ({
      id,
      nombre,
    }));
  }

  /** Diagnóstico de la captura: vehículos del grupo, última vuelta y posiciones guardadas. */
  @Get('estado') estado(): Promise<EstadoGpsDto> {
    return this.captura.estado();
  }

  @Get() obtener(@Query() f: FiltroRecorridoDto) {
    return this.servicio.obtener(f);
  }
}

@Module({
  controllers: [RecorridosController],
  providers: [
    RecorridosService,
    FmTrackService,
    HistorialGpsService,
    CapturaGpsService,
  ],
})
export class RecorridosModule {}
