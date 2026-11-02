import {
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  ParseIntPipe,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  calcularControlFlete,
  comisionFlete,
  formatearFecha,
  type DatosControlFlete,
  type FilaControlFleteDto,
  type FiltroInforme,
  type FormatoExportacion,
  type InformeFacturacionDto,
  type LineaFacturacionDto,
  type ResumenFacturacionDto,
} from '@nexustrack/shared';
import { noEncontrado } from '../comun/errores.js';
import { aIso, rangoFechas } from '../comun/fechas.js';
import { Fecha, Id } from '../comun/validacion.js';
import { aArchivo, ExportacionService } from '../exportacion/exportacion.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { tramoDeCarga } from '../documentos/retiro.mapper.js';

class FiltroInformeDto implements FiltroInforme {
  @Fecha('Desde', { opcional: true }) desde?: string;
  @Fecha('Hasta', { opcional: true }) hasta?: string;
  @Id('Cliente', { opcional: true }) clienteId?: number;
}

/** Lo que el control de fletes lee de cada orden de carga y sus documentos. */
const seleccionControl = {
  id: true,
  numero: true,
  estado: true,
  totalNeto: true,
  tramo: { select: { tramo: true } },
  guias: { select: { tramoTexto: true }, orderBy: { linea: 'asc' } },
  rendiciones: {
    where: { estado: 'EMITIDO' },
    select: {
      id: true,
      numero: true,
      fechaSalida: true,
      fechaLlegada: true,
      kmRecorridos: true,
      horasMotor: true,
      peajes: true,
      carga: true,
      descarga: true,
      petroleo: true,
      totalViaticos: true,
      totalOtrosGastos: true,
    },
  },
  ordenRetiro: {
    select: {
      id: true,
      numero: true,
      fecha: true,
      clienteId: true,
      cliente: { select: { nombre: true } },
      conductor: { select: { nombre: true, comision: true } },
      valesDinero: {
        where: { estado: 'EMITIDO' },
        select: { numero: true, monto: true },
        orderBy: { numero: 'asc' },
      },
      valesCombustible: {
        where: { estado: 'EMITIDO' },
        select: { litrosCamion: true, litrosRemolque: true, total: true },
      },
    },
  },
} satisfies Prisma.OrdenCargaSelect;
type CargaControl = Prisma.OrdenCargaGetPayload<{
  select: typeof seleccionControl;
}>;

const seleccionFacturacion = {
  id: true,
  numero: true,
  fechaCarga: true,
  ordenRetiro: {
    select: { cliente: { select: { id: true, nombre: true, rut: true } } },
  },
  guias: {
    select: {
      numeroGuia: true,
      fechaGuia: true,
      especie: { select: { valor: true } },
      umEspecie: { select: { valor: true } },
      cantidadEspecie: true,
      numeroContenedor: true,
      tramoTexto: true,
      umTarifa: { select: { valor: true } },
      cantidadTarifa: true,
      valorUnitario: true,
      total: true,
    },
    orderBy: { linea: 'asc' },
  },
} satisfies Prisma.OrdenCargaSelect;
type CargaFacturacion = Prisma.OrdenCargaGetPayload<{
  select: typeof seleccionFacturacion;
}>;

const sumar = <T>(lista: T[], valor: (x: T) => number) =>
  lista.reduce((s, x) => s + valor(x), 0);
const distintos = (valores: (string | null | undefined)[], separador: string) =>
  [...new Set(valores.filter((v): v is string => !!v))].join(separador) || null;

function aFilaControl(c: CargaControl): FilaControlFleteDto {
  const o = c.ordenRetiro;
  const r = c.rendiciones[0];
  const datos: DatosControlFlete = {
    distancia: r?.kmRecorridos ?? null,
    litrosCamion: sumar(o.valesCombustible, (v) => v.litrosCamion),
    litrosRemolque: sumar(o.valesCombustible, (v) => v.litrosRemolque),
    horometro: r?.horasMotor ?? null,
    anticipo: sumar(o.valesDinero, (v) => v.monto),
    peajes: r?.peajes ?? 0,
    viatico: r?.totalViaticos ?? 0,
    cargaDescarga: (r?.carga ?? 0) + (r?.descarga ?? 0),
    petroleo: r?.petroleo ?? 0,
    otrosGastos: r?.totalOtrosGastos ?? 0,
    combustible: sumar(o.valesCombustible, (v) => v.total),
    comisiones: comisionFlete(c.totalNeto, o.conductor.comision),
    valorFlete: c.totalNeto,
  };
  return {
    id: c.id,
    ordenRetiroId: o.id,
    rendicionId: r?.id ?? null,
    estado: c.estado,
    conductor: o.conductor.nombre,
    fecha: aIso(o.fecha)!,
    ordenRetiro: o.numero,
    ordenCarga: c.numero,
    rendicion: r?.numero ?? null,
    fechaInicio: aIso(r?.fechaSalida),
    fechaTermino: aIso(r?.fechaLlegada),
    clienteId: o.clienteId,
    cliente: o.cliente.nombre,
    tramo: tramoDeCarga(c.tramo?.tramo, c.guias),
    numerosAnticipo: o.valesDinero
      .map((v) => String(v.numero).padStart(6, '0'))
      .join(', '),
    ...datos,
    ...calcularControlFlete(datos),
  };
}

/**
 * Líneas del informe de facturación de una orden de carga: sus guías agrupadas por tarifa
 * (tramo, unidad y valor unitario). Los números de guía distintos van separados por guion.
 */
export function lineasFacturacion(c: CargaFacturacion): LineaFacturacionDto[] {
  const grupos = new Map<string, CargaFacturacion['guias']>();
  for (const g of c.guias) {
    const clave = [g.tramoTexto, g.umTarifa?.valor, g.valorUnitario].join('|');
    grupos.set(clave, [...(grupos.get(clave) ?? []), g]);
  }
  return [...grupos.values()].map((guias) => {
    const primera = guias[0]!;
    const conCantidad = guias.filter((g) => g.cantidadEspecie !== null);
    return {
      ordenCargaId: c.id,
      ordenCarga: c.numero,
      fechaOrdenCarga: aIso(c.fechaCarga)!,
      guias: distintos(
        guias.map((g) => g.numeroGuia),
        ' - ',
      )!,
      fechaGuia: aIso(primera.fechaGuia)!,
      especie: distintos(
        guias.map((g) => g.especie?.valor),
        ' / ',
      ),
      umEspecie: distintos(
        guias.map((g) => g.umEspecie?.valor),
        ' / ',
      ),
      cantidadEspecie: conCantidad.length
        ? sumar(conCantidad, (g) => g.cantidadEspecie!)
        : null,
      contenedor: distintos(
        guias.map((g) => g.numeroContenedor),
        ' / ',
      ),
      tramo: primera.tramoTexto,
      umTarifa: primera.umTarifa?.valor ?? null,
      cantidadTarifa: sumar(guias, (g) => g.cantidadTarifa),
      valorUnitario: primera.valorUnitario,
      total: sumar(guias, (g) => g.total),
    };
  });
}

const periodo = (f: FiltroInforme) =>
  f.desde || f.hasta
    ? `${formatearFecha(f.desde) || '…'} al ${formatearFecha(f.hasta) || '…'}`
    : 'Todo';

/**
 * Informes de solo lectura calculados desde los documentos: no guardan nada propio. Las órdenes
 * anuladas no entran.
 */
@Injectable()
export class InformesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exportacion: ExportacionService,
  ) {}

  /** Una fila por flete (orden de carga), filtrado por la fecha de la orden de retiro. */
  async controlFletes(f: FiltroInforme): Promise<FilaControlFleteDto[]> {
    const cargas = await this.prisma.ordenCarga.findMany({
      where: {
        estado: { not: 'ANULADA' },
        ordenRetiro: {
          fecha: rangoFechas(f.desde, f.hasta),
          clienteId: f.clienteId,
        },
      },
      select: seleccionControl,
      orderBy: [{ ordenRetiro: { fecha: 'asc' } }, { numero: 'asc' }],
      take: 5000,
    });
    return cargas.map(aFilaControl);
  }

  /** Órdenes de carga con guías en el período (por fecha de carga), con o sin rendición. */
  private async cargasPorFacturar(
    f: FiltroInforme,
  ): Promise<CargaFacturacion[]> {
    return this.prisma.ordenCarga.findMany({
      where: {
        estado: { not: 'ANULADA' },
        guias: { some: {} },
        fechaCarga: rangoFechas(f.desde, f.hasta),
        ordenRetiro: { clienteId: f.clienteId },
      },
      select: seleccionFacturacion,
      orderBy: [{ fechaCarga: 'asc' }, { numero: 'asc' }],
      take: 5000,
    });
  }

  /** Clientes con órdenes por facturar en el período y su total. */
  async resumenFacturacion(f: FiltroInforme): Promise<ResumenFacturacionDto[]> {
    const porCliente = new Map<number, ResumenFacturacionDto>();
    for (const c of await this.cargasPorFacturar(f)) {
      const cliente = c.ordenRetiro.cliente;
      const r = porCliente.get(cliente.id) ?? {
        clienteId: cliente.id,
        cliente: cliente.nombre,
        rut: cliente.rut,
        ordenes: 0,
        guias: 0,
        total: 0,
      };
      r.ordenes += 1;
      r.guias += c.guias.length;
      r.total += sumar(c.guias, (g) => g.total);
      porCliente.set(cliente.id, r);
    }
    return [...porCliente.values()].sort((a, b) =>
      a.cliente.localeCompare(b.cliente, 'es'),
    );
  }

  async facturacion(
    clienteId: number,
    f: FiltroInforme,
  ): Promise<InformeFacturacionDto> {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { id: true, nombre: true, rut: true },
    });
    if (!cliente) throw noEncontrado('El cliente');
    const lineas = (await this.cargasPorFacturar({ ...f, clienteId })).flatMap(
      lineasFacturacion,
    );
    return {
      clienteId: cliente.id,
      cliente: cliente.nombre,
      rut: cliente.rut,
      desde: f.desde ?? null,
      hasta: f.hasta ?? null,
      lineas,
      total: sumar(lineas, (l) => l.total),
    };
  }

  async exportarFacturacion(
    clienteId: number,
    f: FiltroInforme,
    formato: FormatoExportacion,
  ) {
    const i = await this.facturacion(clienteId, f);
    return this.exportacion.informe(
      {
        titulo: 'Informe órdenes de carga por facturar',
        nombreArchivo: `por-facturar-${i.cliente}-${f.desde ?? ''}-${f.hasta ?? ''}`,
        datos: [
          { etiqueta: 'Período (desde-hasta)', valor: periodo(f) },
          { etiqueta: 'Razón social', valor: i.cliente },
          { etiqueta: 'RUT', valor: i.rut },
        ],
        columnas: [
          { campo: 'cliente', titulo: 'Cliente' },
          { campo: 'ordenCarga', titulo: 'N° Orden de Carga' },
          {
            campo: 'fechaOrdenCarga',
            titulo: 'Fecha Orden de Carga',
            tipo: 'fecha',
          },
          { campo: 'guias', titulo: 'N° Guía' },
          { campo: 'fechaGuia', titulo: 'Fecha Guía', tipo: 'fecha' },
          { campo: 'especie', titulo: 'Especie' },
          { campo: 'umEspecie', titulo: 'Unidad de Medida Especie' },
          { campo: 'cantidadEspecie', titulo: 'Cantidad', tipo: 'decimal' },
          { campo: 'contenedor', titulo: 'N° Contenedor' },
          { campo: 'tramo', titulo: 'Tramo/Tarifa' },
          { campo: 'umTarifa', titulo: 'Unidad de Medida Tarifa' },
          { campo: 'cantidadTarifa', titulo: 'Cantidad', tipo: 'decimal' },
          { campo: 'valorUnitario', titulo: 'Valor Unitario $', tipo: 'pesos' },
          { campo: 'total', titulo: 'Total $', tipo: 'pesos' },
        ],
        filas: i.lineas.map((l) => ({
          ...l,
          cliente: i.cliente,
          ordenCarga: String(l.ordenCarga).padStart(6, '0'),
        })),
        totales: [
          {
            etiqueta: 'Valor total a facturar',
            valor: i.total,
            tipo: 'pesos',
          },
        ],
      },
      formato,
    );
  }
}

@ApiTags('Informes')
@Controller('informes')
export class InformesController {
  constructor(private readonly servicio: InformesService) {}

  @Get('control-fletes') controlFletes(@Query() f: FiltroInformeDto) {
    return this.servicio.controlFletes(f);
  }

  @Get('facturacion') resumenFacturacion(@Query() f: FiltroInformeDto) {
    return this.servicio.resumenFacturacion(f);
  }

  @Get('facturacion/:clienteId') facturacion(
    @Param('clienteId', ParseIntPipe) clienteId: number,
    @Query() f: FiltroInformeDto,
  ) {
    return this.servicio.facturacion(clienteId, f);
  }

  @Get('facturacion/:clienteId/pdf') async pdf(
    @Param('clienteId', ParseIntPipe) clienteId: number,
    @Query() f: FiltroInformeDto,
  ): Promise<StreamableFile> {
    return aArchivo(
      await this.servicio.exportarFacturacion(clienteId, f, 'pdf'),
    );
  }

  @Get('facturacion/:clienteId/xlsx') async xlsx(
    @Param('clienteId', ParseIntPipe) clienteId: number,
    @Query() f: FiltroInformeDto,
  ): Promise<StreamableFile> {
    return aArchivo(
      await this.servicio.exportarFacturacion(clienteId, f, 'xlsx'),
    );
  }
}

@Module({
  controllers: [InformesController],
  providers: [InformesService],
})
export class InformesModule {}
