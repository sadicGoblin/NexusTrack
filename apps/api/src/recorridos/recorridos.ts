import {
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FiltroRecorrido, RecorridoDto } from '@nexustrack/shared';
import { invalido } from '../comun/errores.js';
import { chileAUtc } from '../comun/fechas.js';
import { FechaHora, Texto } from '../comun/validacion.js';
import { analizarRecorrido } from './analisis.js';
import { FmTrackService } from './fm-track.js';

class FiltroRecorridoDto implements FiltroRecorrido {
  @Texto('Patente', { max: 12, mayusculas: true }) patente!: string;
  @FechaHora('Salida') desde!: string;
  @FechaHora('Llegada') hasta!: string;
}

const MAX_DIAS = 10;
const VIGENCIA_CACHE = 5 * 60_000;
const MAX_CACHE = 50;

/**
 * Recorrido GPS de un camión entre la salida y la llegada de una rendición (solo historial). Las
 * consultas recientes quedan en memoria unos minutos: revisar la misma rendición no vuelve a
 * pedir las posiciones al GPS.
 */
@Injectable()
export class RecorridosService {
  private readonly cache = new Map<
    string,
    { creado: number; recorrido: RecorridoDto }
  >();

  constructor(private readonly gps: FmTrackService) {}

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

    const vehiculo = await this.gps.buscarVehiculo(f.patente);
    if (!vehiculo)
      throw new NotFoundException(
        `El camión ${f.patente} no está registrado en el GPS.`,
      );

    const clave = `${vehiculo.id}|${desde.toISOString()}|${hasta.toISOString()}`;
    const guardado = this.cache.get(clave);
    if (guardado && Date.now() - guardado.creado < VIGENCIA_CACHE)
      return guardado.recorrido;

    const { puntos, truncado } = await this.gps.posiciones(
      vehiculo.id,
      desde,
      hasta,
    );
    const recorrido: RecorridoDto = {
      patente: f.patente,
      vehiculo: vehiculo.nombre,
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      ...analizarRecorrido(puntos),
      truncado,
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
  constructor(private readonly servicio: RecorridosService) {}

  @Get() obtener(@Query() f: FiltroRecorridoDto) {
    return this.servicio.obtener(f);
  }
}

@Module({
  controllers: [RecorridosController],
  providers: [RecorridosService, FmTrackService],
})
export class RecorridosModule {}
