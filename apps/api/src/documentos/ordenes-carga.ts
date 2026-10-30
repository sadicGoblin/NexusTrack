import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  EstadoOrdenCarga,
  totalLineaGuia,
  type FormatoExportacion,
  type GuiaFleteInput,
  type OrdenCargaDto,
  type OrdenCargaInput,
  type UsuarioSesion,
} from '@nexustrack/shared';
import { RequierePermiso, UsuarioActual } from '../comun/decoradores.js';
import { AnularDto, FiltroFechasDto } from '../comun/dto.js';
import { conflicto, invalido, noEncontrado } from '../comun/errores.js';
import { aFecha, aIso, rangoFechas } from '../comun/fechas.js';
import {
  Booleano,
  Decimal,
  Fecha,
  Hora,
  Id,
  Lista,
  Monto,
  Opcion,
  Texto,
} from '../comun/validacion.js';
import { AuditoriaService } from '../comun/auditoria.service.js';
import { ReferenciasService } from '../comun/referencias.service.js';
import { SecuenciasService } from '../comun/secuencias.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { aArchivo, ExportacionService } from '../exportacion/exportacion.js';
import type { OrdenCarga, Prisma } from '../generated/prisma/client.js';
import {
  aResumenRetiro,
  etiquetaEstado,
  includeRetiro,
  seccionRetiro,
} from './retiro.mapper.js';

class GuiaDtoIn implements GuiaFleteInput {
  @Texto('N° guía', { max: 30, mayusculas: true }) numeroGuia!: string;
  @Fecha('Fecha de guía') fechaGuia!: string;
  @Id('Especie', { opcional: true }) especieId?: number | null;
  @Id('Unidad de medida especie', { opcional: true }) umEspecieId?:
    number | null;
  @Decimal('Cantidad especie', { opcional: true, min: 0, max: 1_000_000 })
  cantidadEspecie?: number | null;
  @Texto('N° contenedor', { opcional: true, max: 30, mayusculas: true })
  numeroContenedor?: string | null;
  @Id('Tramo/Tarifa') tramoId!: number;
  @Id('Unidad de medida tarifa', { opcional: true }) umTarifaId?: number | null;
  @Decimal('Cantidad tarifa', { min: 0, max: 1_000_000 })
  cantidadTarifa!: number;
  @Monto('Valor unitario', { opcional: true }) valorUnitario?: number | null;
}

class OrdenCargaDtoIn implements OrdenCargaInput {
  @Id('Orden de retiro') ordenRetiroId!: number;
  @Id('Tramo', { opcional: true }) tramoId?: number | null;
  @Fecha('Fecha de carga') fechaCarga!: string;
  @Hora('Hora de carga', { opcional: true }) horaCarga?: string | null;
  @Id('Packing de carga', { opcional: true }) packingCargaId?: number | null;
  @Texto('Observaciones', { opcional: true, max: 1000 }) observaciones?:
    string | null;
  @Lista('Guías', () => GuiaDtoIn, { max: 100 }) guias!: GuiaDtoIn[];
}

class FiltroCargas extends FiltroFechasDto {
  @Opcion('Estado', Object.values(EstadoOrdenCarga), { opcional: true })
  estado?: EstadoOrdenCarga;
  @Booleano('Por rendir', {
    opcional: true,
    descripcion: 'Abiertas con guías registradas: admiten rendición',
  })
  porRendir?: boolean;
}

const include = {
  ordenRetiro: { include: includeRetiro },
  tramo: true,
  packingCarga: true,
  guias: {
    include: { especie: true, umEspecie: true, umTarifa: true },
    orderBy: { linea: 'asc' },
  },
  rendiciones: {
    where: { estado: 'EMITIDO' },
    select: { id: true, numero: true },
  },
} satisfies Prisma.OrdenCargaInclude;
type Fila = Prisma.OrdenCargaGetPayload<{ include: typeof include }>;

function aDto(o: Fila): OrdenCargaDto {
  return {
    id: o.id,
    numero: o.numero,
    estado: o.estado,
    ordenRetiroId: o.ordenRetiroId,
    tramoId: o.tramoId,
    tramo: o.tramo?.tramo ?? null,
    fechaCarga: aIso(o.fechaCarga)!,
    horaCarga: o.horaCarga,
    packingCargaId: o.packingCargaId,
    packingCarga: o.packingCarga?.nombre ?? null,
    patenteCamion: o.patenteCamion,
    patenteRemolque: o.patenteRemolque,
    hojaRuta: o.hojaRuta,
    guiasConfirmadas: o.guiasConfirmadas?.toISOString() ?? null,
    totalNeto: o.totalNeto,
    observaciones: o.observaciones,
    motivoAnulacion: o.motivoAnulacion,
    rendicionNumero: o.rendiciones[0]?.numero ?? null,
    rendicionId: o.rendiciones[0]?.id ?? null,
    retiro: aResumenRetiro(o.ordenRetiro),
    guias: o.guias.map((g) => ({
      id: g.id,
      linea: g.linea,
      numeroGuia: g.numeroGuia,
      fechaGuia: aIso(g.fechaGuia)!,
      especieId: g.especieId,
      especie: g.especie?.valor ?? null,
      umEspecieId: g.umEspecieId,
      umEspecie: g.umEspecie?.valor ?? null,
      cantidadEspecie: g.cantidadEspecie,
      numeroContenedor: g.numeroContenedor,
      tramoId: g.tramoId,
      tramoTexto: g.tramoTexto,
      umTarifaId: g.umTarifaId,
      umTarifa: g.umTarifa?.valor ?? null,
      cantidadTarifa: g.cantidadTarifa,
      valorUnitario: g.valorUnitario,
      total: g.total,
    })),
  };
}

@Injectable()
export class OrdenesCargaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly refs: ReferenciasService,
    private readonly secuencias: SecuenciasService,
    private readonly exportacion: ExportacionService,
  ) {}

  async listar(f: FiltroCargas): Promise<OrdenCargaDto[]> {
    const filas = await this.prisma.ordenCarga.findMany({
      where: {
        fechaCarga: rangoFechas(f.desde, f.hasta),
        ...(f.porRendir
          ? { estado: 'ABIERTA', hojaRuta: { not: null } }
          : f.estado
            ? { estado: f.estado }
            : {}),
      },
      include,
      orderBy: [{ fechaCarga: 'desc' }, { numero: 'desc' }],
      take: 5000,
    });
    return filas.map(aDto);
  }

  async obtener(id: number): Promise<OrdenCargaDto> {
    const o = await this.prisma.ordenCarga.findUnique({
      where: { id },
      include,
    });
    if (!o) throw noEncontrado('La orden de carga');
    return aDto(o);
  }

  /** Valida tramo, packing y guías; devuelve las líneas listas para guardar y el total neto. */
  private async preparar(
    tx: Tx,
    dto: OrdenCargaDtoIn,
    clienteId: number,
    antes?: OrdenCarga,
  ) {
    const rutaDelCliente = async (id: number, etiqueta: string) => {
      const r = await tx.rutaTarifa.findUnique({ where: { id } });
      if (!r || r.clienteId !== clienteId)
        throw invalido(
          `${etiqueta}: el tramo no corresponde al cliente de la orden de retiro.`,
        );
      return r;
    };
    if (dto.tramoId) await rutaDelCliente(dto.tramoId, 'Tramo');
    await this.refs.packing(
      tx,
      dto.packingCargaId,
      'Packing de carga',
      antes?.packingCargaId,
    );
    const lineas: Prisma.GuiaFleteCreateManyOrdenCargaInput[] = [];
    for (const [i, g] of dto.guias.entries()) {
      const etiqueta = `Guía línea ${i + 1}`;
      const ruta = await rutaDelCliente(g.tramoId, etiqueta);
      await this.refs.catalogoOpcional(
        tx,
        g.especieId,
        'ESPECIE',
        `${etiqueta}, especie`,
      );
      await this.refs.catalogoOpcional(
        tx,
        g.umEspecieId,
        'UM_ESPECIE',
        `${etiqueta}, unidad de medida especie`,
      );
      await this.refs.catalogoOpcional(
        tx,
        g.umTarifaId,
        'UM_TARIFA',
        `${etiqueta}, unidad de medida tarifa`,
      );
      const valorUnitario = g.valorUnitario ?? ruta.valor;
      lineas.push({
        linea: i + 1,
        numeroGuia: g.numeroGuia,
        fechaGuia: aFecha(g.fechaGuia)!,
        especieId: g.especieId ?? null,
        umEspecieId: g.umEspecieId ?? null,
        cantidadEspecie: g.cantidadEspecie ?? null,
        numeroContenedor: g.numeroContenedor ?? null,
        tramoId: ruta.id,
        tramoTexto: ruta.tramo,
        umTarifaId: g.umTarifaId ?? null,
        cantidadTarifa: g.cantidadTarifa,
        valorUnitario,
        total: totalLineaGuia(g.cantidadTarifa, valorUnitario),
      });
    }
    return { lineas, totalNeto: lineas.reduce((s, l) => s + l.total, 0) };
  }

  /** Al registrar las primeras guías se asigna el correlativo de hoja de ruta. */
  private async hojaRuta(tx: Tx, actual: number | null, hayGuias: boolean) {
    if (actual || !hayGuias)
      return { hojaRuta: actual, guiasConfirmadas: undefined };
    return {
      hojaRuta: await this.secuencias.siguiente(tx, 'HOJA_RUTA'),
      guiasConfirmadas: new Date(),
    };
  }

  async crear(dto: OrdenCargaDtoIn, u: UsuarioSesion): Promise<OrdenCargaDto> {
    return this.prisma.$transaction(async (tx) => {
      const retiro = await tx.ordenRetiro.findUnique({
        where: { id: dto.ordenRetiroId },
        include: { camion: true, remolque: true },
      });
      if (!retiro) throw invalido('La orden de retiro seleccionada no existe.');
      if (retiro.estado !== 'ABIERTA') {
        throw conflicto(
          `La orden de retiro N° ${retiro.numero} no admite orden de carga (${etiquetaEstado(retiro.estado).toLowerCase()}).`,
        );
      }
      const { lineas, totalNeto } = await this.preparar(
        tx,
        dto,
        retiro.clienteId,
      );
      const numero = await this.secuencias.siguiente(tx, 'ORDEN_CARGA');
      const hr = await this.hojaRuta(tx, null, lineas.length > 0);
      const o = await tx.ordenCarga.create({
        data: {
          numero,
          ordenRetiroId: retiro.id,
          tramoId: dto.tramoId ?? null,
          fechaCarga: aFecha(dto.fechaCarga)!,
          horaCarga: dto.horaCarga ?? null,
          packingCargaId: dto.packingCargaId ?? null,
          observaciones: dto.observaciones ?? null,
          patenteCamion: retiro.camion.patente,
          patenteRemolque: retiro.remolque?.patente ?? null,
          totalNeto,
          ...hr,
          guias: { createMany: { data: lineas } },
          creadoPorId: u.id,
          actualizadoPorId: u.id,
        },
        include,
      });
      await tx.ordenRetiro.update({
        where: { id: retiro.id },
        data: { estado: 'CON_CARGA', actualizadoPorId: u.id },
      });
      await this.auditoria.registrar(tx, {
        entidad: 'OrdenCarga',
        entidadId: o.id,
        accion: 'CREAR',
        usuarioId: u.id,
        cambios: { ...this.auditoria.instantanea(o), guias: lineas.length },
      });
      return aDto({
        ...o,
        ordenRetiro: { ...o.ordenRetiro, estado: 'CON_CARGA' },
      });
    });
  }

  async actualizar(
    id: number,
    dto: OrdenCargaDtoIn,
    u: UsuarioSesion,
  ): Promise<OrdenCargaDto> {
    return this.prisma.$transaction(async (tx) => {
      const antes = await tx.ordenCarga.findUnique({
        where: { id },
        include: { ordenRetiro: true, guias: true },
      });
      if (!antes) throw noEncontrado('La orden de carga');
      if (antes.estado !== 'ABIERTA') {
        throw conflicto(
          `La orden de carga está ${etiquetaEstado(antes.estado).toLowerCase()} y no se puede modificar.`,
        );
      }
      if (dto.ordenRetiroId !== antes.ordenRetiroId)
        throw invalido(
          'No se puede cambiar la orden de retiro de una orden de carga.',
        );
      const { lineas, totalNeto } = await this.preparar(
        tx,
        dto,
        antes.ordenRetiro.clienteId,
        antes,
      );
      const hr = await this.hojaRuta(tx, antes.hojaRuta, lineas.length > 0);
      await tx.guiaFlete.deleteMany({ where: { ordenCargaId: id } });
      const o = await tx.ordenCarga.update({
        where: { id },
        data: {
          tramoId: dto.tramoId ?? null,
          fechaCarga: aFecha(dto.fechaCarga)!,
          horaCarga: dto.horaCarga ?? null,
          packingCargaId: dto.packingCargaId ?? null,
          observaciones: dto.observaciones ?? null,
          totalNeto,
          ...hr,
          guias: { createMany: { data: lineas } },
          actualizadoPorId: u.id,
        },
        include,
      });
      const cambios: Record<string, unknown> = this.auditoria.diferencias(
        antes,
        o,
      );
      if (
        antes.guias.length !== lineas.length ||
        antes.totalNeto !== totalNeto
      ) {
        cambios['guias'] = {
          antes: antes.guias.length,
          despues: lineas.length,
        };
      }
      await this.auditoria.registrar(tx, {
        entidad: 'OrdenCarga',
        entidadId: id,
        accion: 'EDITAR',
        usuarioId: u.id,
        cambios,
      });
      return aDto(o);
    });
  }

  async anular(
    id: number,
    motivo: string,
    u: UsuarioSesion,
  ): Promise<OrdenCargaDto> {
    return this.prisma.$transaction(async (tx) => {
      const antes = await tx.ordenCarga.findUnique({
        where: { id },
        include: {
          rendiciones: { where: { estado: 'EMITIDO' } },
          ordenRetiro: true,
        },
      });
      if (!antes) throw noEncontrado('La orden de carga');
      if (antes.estado === 'ANULADA')
        throw conflicto('La orden de carga ya está anulada.');
      if (antes.rendiciones.length)
        throw conflicto(
          `Anule primero la rendición N° ${antes.rendiciones[0].numero}.`,
        );
      const o = await tx.ordenCarga.update({
        where: { id },
        data: {
          estado: 'ANULADA',
          motivoAnulacion: motivo,
          anuladoEn: new Date(),
          actualizadoPorId: u.id,
        },
        include,
      });
      if (antes.ordenRetiro.estado === 'CON_CARGA') {
        await tx.ordenRetiro.update({
          where: { id: antes.ordenRetiroId },
          data: { estado: 'ABIERTA', actualizadoPorId: u.id },
        });
      }
      await this.auditoria.registrar(tx, {
        entidad: 'OrdenCarga',
        entidadId: id,
        accion: 'ANULAR',
        usuarioId: u.id,
        cambios: { motivo },
      });
      return aDto(o);
    });
  }

  async exportar(id: number, formato: FormatoExportacion) {
    const o = await this.obtener(id);
    const r = o.retiro;
    return this.exportacion.documento(
      {
        titulo: 'Orden de Carga',
        numero: o.numero,
        fecha: o.fechaCarga,
        estado: etiquetaEstado(o.estado),
        anulado:
          o.estado === 'ANULADA' ? { motivo: o.motivoAnulacion } : undefined,
        nombreArchivo: `orden-carga-${String(o.numero).padStart(6, '0')}`,
        secciones: [
          {
            titulo: 'Carga',
            campos: [
              {
                etiqueta: 'N° hoja de ruta',
                valor: o.hojaRuta
                  ? String(o.hojaRuta).padStart(6, '0')
                  : 'Pendiente',
              },
              { etiqueta: 'Tramo', valor: o.tramo, ancho: 3 },
              {
                etiqueta: 'Fecha de carga',
                valor: o.fechaCarga,
                tipo: 'fecha',
              },
              { etiqueta: 'Hora de carga', valor: o.horaCarga },
              { etiqueta: 'Packing de carga', valor: o.packingCarga, ancho: 2 },
              { etiqueta: 'Patente camión', valor: o.patenteCamion },
              { etiqueta: 'Patente remolque', valor: o.patenteRemolque },
            ],
          },
          seccionRetiro(r),
          {
            titulo: 'Embarque y entrega',
            campos: [
              { etiqueta: 'Puerto de embarque', valor: r.puertoEmbarque },
              {
                etiqueta: 'Fecha de embarque',
                valor: r.fechaEmbarque,
                tipo: 'fecha',
              },
              { etiqueta: 'Hora de embarque', valor: r.horaEmbarque },
              { etiqueta: 'Depósito de retiro', valor: r.depositoRetiro },
              {
                etiqueta: 'Depósito de entrega',
                valor: r.depositoEntrega,
                ancho: 2,
              },
              {
                etiqueta: 'Packing de entrega',
                valor: r.packingEntrega,
                ancho: 2,
              },
            ],
          },
        ],
        tablas: [
          {
            titulo: 'Guías del flete',
            columnas: [
              { campo: 'numeroGuia', titulo: 'N° guía' },
              { campo: 'fechaGuia', titulo: 'Fecha', tipo: 'fecha' },
              { campo: 'especie', titulo: 'Especie' },
              { campo: 'umEspecie', titulo: 'U.M. especie' },
              { campo: 'cantidadEspecie', titulo: 'Cantidad', tipo: 'decimal' },
              { campo: 'numeroContenedor', titulo: 'N° contenedor' },
              { campo: 'tramoTexto', titulo: 'Tramo/Tarifa' },
              { campo: 'umTarifa', titulo: 'U.M. tarifa' },
              { campo: 'cantidadTarifa', titulo: 'Cantidad', tipo: 'decimal' },
              {
                campo: 'valorUnitario',
                titulo: 'Valor unitario',
                tipo: 'pesos',
              },
              { campo: 'total', titulo: 'Total', tipo: 'pesos' },
            ],
            filas: o.guias as unknown as Record<string, unknown>[],
            totales: [
              {
                etiqueta: 'Total neto guías',
                valor: o.totalNeto,
                tipo: 'pesos',
              },
            ],
          },
        ],
        observaciones: o.observaciones,
        firmas: ['Firma conductor', 'Firma responsable de carga'],
      },
      formato,
    );
  }
}

@ApiTags('Documentos')
@Controller('ordenes-carga')
export class OrdenesCargaController {
  constructor(private readonly servicio: OrdenesCargaService) {}

  @Get() listar(@Query() f: FiltroCargas) {
    return this.servicio.listar(f);
  }

  @Get(':id') obtener(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.obtener(id);
  }

  @Get(':id/pdf') async pdf(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StreamableFile> {
    return aArchivo(await this.servicio.exportar(id, 'pdf'));
  }

  @Get(':id/xlsx') async xlsx(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StreamableFile> {
    return aArchivo(await this.servicio.exportar(id, 'xlsx'));
  }

  @RequierePermiso('editarOperacion')
  @Post()
  crear(@Body() dto: OrdenCargaDtoIn, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.crear(dto, u);
  }

  @RequierePermiso('editarOperacion')
  @Put(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: OrdenCargaDtoIn,
    @UsuarioActual() u: UsuarioSesion,
  ) {
    return this.servicio.actualizar(id, dto, u);
  }

  @RequierePermiso('anular')
  @Post(':id/anular')
  anular(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnularDto,
    @UsuarioActual() u: UsuarioSesion,
  ) {
    return this.servicio.anular(id, dto.motivo, u);
  }
}

@Module({
  controllers: [OrdenesCargaController],
  providers: [OrdenesCargaService],
})
export class OrdenesCargaModule {}
