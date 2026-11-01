import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
  ESTADOS_RETIRO_ACTIVOS,
  EstadoDocumento,
  type FormatoExportacion,
  type UsuarioSesion,
  type ValeDineroDto,
  type ValeDineroInput,
} from '@nexustrack/shared';
import { RequierePermiso, UsuarioActual } from '../comun/decoradores.js';
import { AnularDto, FiltroFechasDto } from '../comun/dto.js';
import { conflicto, invalido, noEncontrado } from '../comun/errores.js';
import { aFecha, aIso, rangoFechas } from '../comun/fechas.js';
import { Fecha, Id, Monto, Opcion, Texto } from '../comun/validacion.js';
import { AuditoriaService } from '../comun/auditoria.service.js';
import { ReferenciasService } from '../comun/referencias.service.js';
import { SecuenciasService } from '../comun/secuencias.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { aArchivo, ExportacionService } from '../exportacion/exportacion.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  aResumenRetiro,
  etiquetaEstado,
  includeRetiro,
  seccionRetiro,
} from './retiro.mapper.js';

class ValeDineroDtoIn implements ValeDineroInput {
  @Id('Orden de retiro') ordenRetiroId!: number;
  @Fecha('Fecha de entrega') fechaEntrega!: string;
  @Texto('Concepto', { opcional: true, max: 80, mayusculas: true })
  concepto?: string;
  @Texto('Glosa', { opcional: true, max: 300 }) glosa?: string | null;
  @Id('Sitio de entrega') sitioEntregaId!: number;
  @Monto('Monto entregado', { positivo: true }) monto!: number;
  @Id('Forma de pago') formaPagoId!: number;
}

class FiltroVales extends FiltroFechasDto {
  @Opcion('Estado', Object.values(EstadoDocumento), { opcional: true })
  estado?: EstadoDocumento;
  @Id('Orden de retiro', { opcional: true }) ordenRetiroId?: number;
}

const include = {
  sitioEntrega: true,
  formaPago: true,
  ordenRetiro: { include: includeRetiro },
} satisfies Prisma.ValeDineroInclude;
type Fila = Prisma.ValeDineroGetPayload<{ include: typeof include }>;

function aDto(v: Fila): ValeDineroDto {
  return {
    id: v.id,
    numero: v.numero,
    estado: v.estado,
    ordenRetiroId: v.ordenRetiroId,
    fechaEntrega: aIso(v.fechaEntrega)!,
    concepto: v.concepto,
    glosa: v.glosa,
    sitioEntregaId: v.sitioEntregaId,
    sitioEntrega: v.sitioEntrega.valor,
    monto: v.monto,
    formaPagoId: v.formaPagoId,
    formaPago: v.formaPago.valor,
    motivoAnulacion: v.motivoAnulacion,
    retiro: aResumenRetiro(v.ordenRetiro),
  };
}

@Injectable()
export class ValesDineroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly refs: ReferenciasService,
    private readonly secuencias: SecuenciasService,
    private readonly exportacion: ExportacionService,
  ) {}

  async listar(f: FiltroVales): Promise<ValeDineroDto[]> {
    const filas = await this.prisma.valeDinero.findMany({
      where: {
        fechaEntrega: rangoFechas(f.desde, f.hasta),
        estado: f.estado,
        ordenRetiroId: f.ordenRetiroId,
      },
      include,
      orderBy: { numero: 'desc' },
      take: 5000,
    });
    return filas.map(aDto);
  }

  async obtener(id: number): Promise<ValeDineroDto> {
    const v = await this.prisma.valeDinero.findUnique({
      where: { id },
      include,
    });
    if (!v) throw noEncontrado('El vale de dinero');
    return aDto(v);
  }

  private async validar(
    tx: Tx,
    dto: ValeDineroDtoIn,
    antes?: { sitioEntregaId: number; formaPagoId: number },
  ) {
    await this.refs.catalogo(
      tx,
      dto.sitioEntregaId,
      'SITIO_ENTREGA',
      'Sitio de entrega',
      antes?.sitioEntregaId,
    );
    await this.refs.catalogo(
      tx,
      dto.formaPagoId,
      'FORMA_PAGO',
      'Forma de pago',
      antes?.formaPagoId,
    );
  }

  async crear(dto: ValeDineroDtoIn, u: UsuarioSesion): Promise<ValeDineroDto> {
    return this.prisma.$transaction(async (tx) => {
      const retiro = await tx.ordenRetiro.findUnique({
        where: { id: dto.ordenRetiroId },
      });
      if (!retiro) throw invalido('La orden de retiro seleccionada no existe.');
      if (!ESTADOS_RETIRO_ACTIVOS.includes(retiro.estado)) {
        throw conflicto(
          `La orden de retiro N° ${retiro.numero} no está activa (${etiquetaEstado(retiro.estado).toLowerCase()}).`,
        );
      }
      await this.validar(tx, dto);
      const concepto =
        dto.concepto ||
        (
          await tx.parametro.findUnique({
            where: { clave: 'CONCEPTO_VALE_DINERO' },
          })
        )?.valor ||
        'FLETE';
      const numero = await this.secuencias.siguiente(tx, 'VALE_DINERO');
      const v = await tx.valeDinero.create({
        data: {
          ...dto,
          concepto,
          numero,
          fechaEntrega: aFecha(dto.fechaEntrega)!,
          creadoPorId: u.id,
          actualizadoPorId: u.id,
        },
        include,
      });
      await this.auditoria.registrar(tx, {
        entidad: 'ValeDinero',
        entidadId: v.id,
        accion: 'CREAR',
        usuarioId: u.id,
        cambios: this.auditoria.instantanea(v),
      });
      return aDto(v);
    });
  }

  async actualizar(
    id: number,
    dto: ValeDineroDtoIn,
    u: UsuarioSesion,
  ): Promise<ValeDineroDto> {
    return this.prisma.$transaction(async (tx) => {
      const antes = await tx.valeDinero.findUnique({ where: { id } });
      if (!antes) throw noEncontrado('El vale de dinero');
      if (antes.estado === 'ANULADO')
        throw conflicto('El vale está anulado y no se puede modificar.');
      if (dto.ordenRetiroId !== antes.ordenRetiroId)
        throw invalido(
          'No se puede cambiar la orden de retiro de un vale emitido.',
        );
      await this.validar(tx, dto, antes);
      const v = await tx.valeDinero.update({
        where: { id },
        data: {
          ...dto,
          concepto: dto.concepto || antes.concepto,
          fechaEntrega: aFecha(dto.fechaEntrega)!,
          actualizadoPorId: u.id,
        },
        include,
      });
      await this.auditoria.registrar(tx, {
        entidad: 'ValeDinero',
        entidadId: id,
        accion: 'EDITAR',
        usuarioId: u.id,
        cambios: this.auditoria.diferencias(antes, v),
      });
      return aDto(v);
    });
  }

  async eliminar(id: number, u: UsuarioSesion): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const v = await tx.valeDinero.findUnique({ where: { id } });
      if (!v) throw noEncontrado('El vale de dinero');
      await tx.valeDinero.delete({ where: { id } });
      await this.auditoria.registrar(tx, {
        entidad: 'ValeDinero',
        entidadId: id,
        accion: 'ELIMINAR',
        usuarioId: u.id,
        cambios: this.auditoria.instantanea(v),
      });
    });
  }

  async anular(
    id: number,
    motivo: string,
    u: UsuarioSesion,
  ): Promise<ValeDineroDto> {
    return this.prisma.$transaction(async (tx) => {
      const antes = await tx.valeDinero.findUnique({ where: { id } });
      if (!antes) throw noEncontrado('El vale de dinero');
      if (antes.estado === 'ANULADO')
        throw conflicto('El vale ya está anulado.');
      const v = await tx.valeDinero.update({
        where: { id },
        data: {
          estado: 'ANULADO',
          motivoAnulacion: motivo,
          anuladoEn: new Date(),
          actualizadoPorId: u.id,
        },
        include,
      });
      await this.auditoria.registrar(tx, {
        entidad: 'ValeDinero',
        entidadId: id,
        accion: 'ANULAR',
        usuarioId: u.id,
        cambios: { motivo },
      });
      return aDto(v);
    });
  }

  async exportar(id: number, formato: FormatoExportacion) {
    const v = await this.obtener(id);
    return this.exportacion.documento(
      {
        titulo: 'Vale de Dinero',
        numero: v.numero,
        fecha: v.fechaEntrega,
        estado: etiquetaEstado(v.estado),
        anulado:
          v.estado === 'ANULADO' ? { motivo: v.motivoAnulacion } : undefined,
        nombreArchivo: `vale-dinero-${String(v.numero).padStart(6, '0')}`,
        secciones: [
          {
            titulo: 'Anticipo de viaje',
            campos: [
              {
                etiqueta: 'Fecha de entrega',
                valor: v.fechaEntrega,
                tipo: 'fecha',
              },
              { etiqueta: 'Concepto', valor: v.concepto },
              { etiqueta: 'Sitio de entrega', valor: v.sitioEntrega },
              { etiqueta: 'Forma de pago', valor: v.formaPago },
              {
                etiqueta: 'Monto entregado',
                valor: v.monto,
                tipo: 'pesos',
                ancho: 2,
              },
              { etiqueta: 'Glosa', valor: v.glosa, ancho: 2 },
            ],
          },
          seccionRetiro(v.retiro),
        ],
        tablas: [],
        firmas: ['Recibí conforme (conductor)', 'Entregado por'],
      },
      formato,
    );
  }
}

@ApiTags('Documentos')
@Controller('vales-dinero')
export class ValesDineroController {
  constructor(private readonly servicio: ValesDineroService) {}

  @Get() listar(@Query() f: FiltroVales) {
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

  @RequierePermiso('editarFinanzas')
  @Post()
  crear(@Body() dto: ValeDineroDtoIn, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.crear(dto, u);
  }

  @RequierePermiso('editarFinanzas')
  @Put(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ValeDineroDtoIn,
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

  @RequierePermiso('eliminar')
  @Delete(':id')
  @HttpCode(204)
  eliminar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() u: UsuarioSesion,
  ) {
    return this.servicio.eliminar(id, u);
  }
}

@Module({
  controllers: [ValesDineroController],
  providers: [ValesDineroService],
})
export class ValesDineroModule {}
