import {
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ORIGEN_ESTADIA,
  type FormatoExportacion,
  type HojaRutaDetalleDto,
  type HojaRutaDto,
} from '@nexustrack/shared';
import { FiltroFechasDto } from '../comun/dto.js';
import { noEncontrado } from '../comun/errores.js';
import { aIso, rangoFechas } from '../comun/fechas.js';
import { aArchivo, ExportacionService } from '../exportacion/exportacion.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrdenesCargaModule, OrdenesCargaService } from './ordenes-carga.js';
import {
  detalleRendicion,
  RendicionesModule,
  RendicionesService,
} from './rendiciones.js';
import { etiquetaEstado, tramoDeCarga } from './retiro.mapper.js';

const gastos = {
  id: true,
  numero: true,
  peajes: true,
  carga: true,
  descarga: true,
  petroleo: true,
  totalViaticos: true,
  totalOtrosGastos: true,
  totalGeneral: true,
} satisfies Prisma.RendicionSelect;

const seleccionCarga = {
  id: true,
  numero: true,
  hojaRuta: true,
  fechaCarga: true,
  horaCarga: true,
  estado: true,
  patenteCamion: true,
  patenteRemolque: true,
  tramo: { select: { tramo: true } },
  guias: { select: { tramoTexto: true }, orderBy: { linea: 'asc' } },
  rendiciones: { where: { estado: 'EMITIDO' }, select: gastos },
  ordenRetiro: {
    select: {
      id: true,
      numero: true,
      cliente: { select: { nombre: true } },
      origen: { select: { valor: true } },
      destino: { select: { valor: true } },
      conductor: { select: { nombre: true } },
    },
  },
} satisfies Prisma.OrdenCargaSelect;

const seleccionEstadia = {
  ...gastos,
  hojaRuta: true,
  fechaSalida: true,
  horaSalida: true,
  conductor: { select: { nombre: true } },
  camion: { select: { patente: true } },
  remolque: { select: { patente: true } },
  destino: { select: { valor: true } },
} satisfies Prisma.RendicionSelect;

type Gastos = Prisma.RendicionGetPayload<{ select: typeof gastos }>;

function aGastos(r: Gastos | undefined) {
  return {
    rendicionId: r?.id ?? null,
    rendicionNumero: r?.numero ?? null,
    totalGastos: r?.totalGeneral ?? null,
    peajes: r?.peajes ?? null,
    cargaDescarga: r ? r.carga + r.descarga : null,
    viaticos: r?.totalViaticos ?? null,
    varios: r?.totalOtrosGastos ?? null,
    petroleo: r?.petroleo ?? null,
  };
}

function deCarga(
  c: Prisma.OrdenCargaGetPayload<{ select: typeof seleccionCarga }>,
): HojaRutaDto {
  const o = c.ordenRetiro;
  return {
    id: `C${c.id}`,
    numero: c.hojaRuta!,
    tipo: 'FLETE',
    fecha: aIso(c.fechaCarga)!,
    hora: c.horaCarga,
    estado: c.estado,
    origen: o.origen.valor,
    destino: o.destino.valor,
    conductor: o.conductor.nombre,
    patenteCamion: c.patenteCamion,
    patenteRemolque: c.patenteRemolque,
    cliente: o.cliente.nombre,
    tramo: tramoDeCarga(c.tramo?.tramo, c.guias),
    ordenRetiroId: o.id,
    ordenRetiroNumero: o.numero,
    ordenCargaId: c.id,
    ordenCargaNumero: c.numero,
    ...aGastos(c.rendiciones[0]),
  };
}

function deEstadia(
  r: Prisma.RendicionGetPayload<{ select: typeof seleccionEstadia }>,
): HojaRutaDto {
  return {
    id: `E${r.id}`,
    numero: r.hojaRuta!,
    tipo: 'ESTADIA',
    fecha: aIso(r.fechaSalida)!,
    hora: r.horaSalida,
    estado: 'RENDIDA',
    origen: ORIGEN_ESTADIA,
    destino: r.destino!.valor,
    conductor: r.conductor!.nombre,
    patenteCamion: r.camion!.patente,
    patenteRemolque: r.remolque?.patente ?? null,
    cliente: null,
    tramo: null,
    ordenRetiroId: null,
    ordenRetiroNumero: null,
    ordenCargaId: null,
    ordenCargaNumero: null,
    ...aGastos(r),
  };
}

const correlativo = (n: number | null) =>
  n ? String(n).padStart(6, '0') : null;

/** «C12» (orden de carga 12) o «E5» (estadía 5). */
function leerId(id: string): { tipo: 'C' | 'E'; id: number } | null {
  const m = /^([CE])(\d+)$/.exec(id);
  return m ? { tipo: m[1] as 'C' | 'E', id: Number(m[2]) } : null;
}

/**
 * Hojas de ruta: una por flete con guías y una por estadía, numeradas por fecha. Se calculan desde
 * la orden de carga (o la estadía) y su rendición; no tienen tabla propia.
 */
@Injectable()
export class HojasRutaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cargas: OrdenesCargaService,
    private readonly rendiciones: RendicionesService,
    private readonly exportacion: ExportacionService,
  ) {}

  async listar(f: FiltroFechasDto): Promise<HojaRutaDto[]> {
    const rango = rangoFechas(f.desde, f.hasta);
    const [cargas, estadias] = await Promise.all([
      this.prisma.ordenCarga.findMany({
        where: { hojaRuta: { not: null }, fechaCarga: rango },
        select: seleccionCarga,
        take: 5000,
      }),
      this.prisma.rendicion.findMany({
        where: { tipo: 'ESTADIA', hojaRuta: { not: null }, fechaSalida: rango },
        select: seleccionEstadia,
        take: 5000,
      }),
    ]);
    return [...cargas.map(deCarga), ...estadias.map(deEstadia)].sort(
      (a, b) => b.numero - a.numero,
    );
  }

  async obtener(id: string): Promise<HojaRutaDetalleDto> {
    const clave = leerId(id);
    if (clave?.tipo === 'C') {
      const c = await this.prisma.ordenCarga.findFirst({
        where: { id: clave.id, hojaRuta: { not: null } },
        select: seleccionCarga,
      });
      if (c) {
        const r = c.rendiciones[0];
        return {
          ...deCarga(c),
          ordenCarga: await this.cargas.obtener(c.id),
          rendicion: r ? await this.rendiciones.obtener(r.id) : null,
        };
      }
    } else if (clave?.tipo === 'E') {
      const r = await this.prisma.rendicion.findFirst({
        where: { id: clave.id, tipo: 'ESTADIA', hojaRuta: { not: null } },
        select: seleccionEstadia,
      });
      if (r)
        return {
          ...deEstadia(r),
          ordenCarga: null,
          rendicion: await this.rendiciones.obtener(r.id),
        };
    }
    throw noEncontrado('La hoja de ruta');
  }

  async exportar(id: string, formato: FormatoExportacion) {
    const h = await this.obtener(id);
    const detalle = h.rendicion
      ? detalleRendicion(h.rendicion)
      : { secciones: [], tablas: [] };
    return this.exportacion.documento(
      {
        titulo: 'Hoja de Ruta',
        numero: h.numero,
        fecha: h.fecha,
        estado: h.tipo === 'ESTADIA' ? 'Estadía' : etiquetaEstado(h.estado),
        nombreArchivo: `hoja-ruta-${String(h.numero).padStart(6, '0')}`,
        secciones: [
          {
            titulo: 'Hoja de ruta',
            campos: [
              { etiqueta: 'Fecha', valor: h.fecha, tipo: 'fecha' },
              { etiqueta: 'Origen', valor: h.origen },
              { etiqueta: 'Destino', valor: h.destino },
              {
                etiqueta: 'Rendición',
                valor: correlativo(h.rendicionNumero) ?? 'Sin rendir',
              },
              { etiqueta: 'Chofer', valor: h.conductor, ancho: 2 },
              { etiqueta: 'Patente camión', valor: h.patenteCamion },
              { etiqueta: 'Patente remolque', valor: h.patenteRemolque },
              // Una estadía no tiene cliente, tramo ni órdenes.
              ...(h.tipo === 'FLETE'
                ? [
                    {
                      etiqueta: 'Cliente',
                      valor: h.cliente,
                      ancho: 2 as const,
                    },
                    {
                      etiqueta: 'Orden de retiro',
                      valor: correlativo(h.ordenRetiroNumero),
                    },
                    {
                      etiqueta: 'Orden de carga',
                      valor: correlativo(h.ordenCargaNumero),
                    },
                    { etiqueta: 'Tramo', valor: h.tramo, ancho: 4 as const },
                  ]
                : []),
            ],
          },
          ...detalle.secciones,
        ],
        tablas: detalle.tablas,
        observaciones: h.rendicion?.observaciones,
        firmas: ['Firma conductor', 'Revisado por'],
      },
      formato,
    );
  }
}

@ApiTags('Documentos')
@Controller('hojas-ruta')
export class HojasRutaController {
  constructor(private readonly servicio: HojasRutaService) {}

  @Get() listar(@Query() f: FiltroFechasDto) {
    return this.servicio.listar(f);
  }

  @Get(':id') obtener(@Param('id') id: string) {
    return this.servicio.obtener(id);
  }

  @Get(':id/pdf') async pdf(@Param('id') id: string): Promise<StreamableFile> {
    return aArchivo(await this.servicio.exportar(id, 'pdf'));
  }

  @Get(':id/xlsx') async xlsx(
    @Param('id') id: string,
  ): Promise<StreamableFile> {
    return aArchivo(await this.servicio.exportar(id, 'xlsx'));
  }
}

@Module({
  imports: [OrdenesCargaModule, RendicionesModule],
  controllers: [HojasRutaController],
  providers: [HojasRutaService],
})
export class HojasRutaModule {}
