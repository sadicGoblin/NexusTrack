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
  calcularCombustible,
  ESTADOS_RETIRO_ACTIVOS,
  EstadoDocumento,
  type FormatoExportacion,
  type UsuarioSesion,
  type ValeCombustibleDto,
  type ValeCombustibleInput,
} from '@nexustrack/shared';
import { RequierePermiso, UsuarioActual } from '../comun/decoradores.js';
import { AnularDto, FiltroFechasDto } from '../comun/dto.js';
import { conflicto, invalido, noEncontrado } from '../comun/errores.js';
import { aFecha, aIso, rangoFechas } from '../comun/fechas.js';
import {
  Decimal,
  Fecha,
  Hora,
  Id,
  Monto,
  Opcion,
  Texto,
} from '../comun/validacion.js';
import { AuditoriaService } from '../comun/auditoria.service.js';
import { ReferenciasService } from '../comun/referencias.service.js';
import { SecuenciasService } from '../comun/secuencias.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { aArchivo, ExportacionService } from '../exportacion/exportacion.js';
import type { Prisma, ValeCombustible } from '../generated/prisma/client.js';
import {
  aResumenRetiro,
  etiquetaEstado,
  includeRetiro,
  seccionRetiro,
} from './retiro.mapper.js';

const NUMERAL = { opcional: true, min: 0, max: 99_999_999 } as const;

class ValeCombustibleDtoIn implements ValeCombustibleInput {
  @Id('Orden de retiro') ordenRetiroId!: number;
  @Fecha('Fecha de entrega') fechaEntrega!: string;
  @Hora('Hora de entrega', { opcional: true }) horaEntrega?: string | null;
  @Id('Sitio de entrega') sitioEntregaId!: number;
  @Id('Forma de pago', { opcional: true }) formaPagoId?: number | null;
  @Id('Tipo de documento', { opcional: true }) tipoDocumentoId?: number | null;
  @Id('Patente camión') camionId!: number;
  @Id('Patente remolque', { opcional: true }) remolqueId?: number | null;
  @Decimal('Numeral inicial bomba camión', NUMERAL) numeralInicialCamion?:
    number | null;
  @Decimal('Numeral final bomba camión', NUMERAL) numeralFinalCamion?:
    number | null;
  @Decimal('Numeral inicial bomba remolque', NUMERAL) numeralInicialRemolque?:
    number | null;
  @Decimal('Numeral final bomba remolque', NUMERAL) numeralFinalRemolque?:
    number | null;
  @Monto('Valor litro', { positivo: true }) valorLitro!: number;
  @Texto('Observaciones', { opcional: true, max: 1000 }) observaciones?:
    string | null;
}

class FiltroCombustible extends FiltroFechasDto {
  @Opcion('Estado', Object.values(EstadoDocumento), { opcional: true })
  estado?: EstadoDocumento;
  @Id('Orden de retiro', { opcional: true }) ordenRetiroId?: number;
}

const include = {
  sitioEntrega: true,
  formaPago: true,
  tipoDocumento: true,
  camion: true,
  remolque: true,
  ordenRetiro: { include: includeRetiro },
} satisfies Prisma.ValeCombustibleInclude;
type Fila = Prisma.ValeCombustibleGetPayload<{ include: typeof include }>;

function aDto(v: Fila): ValeCombustibleDto {
  return {
    id: v.id,
    numero: v.numero,
    estado: v.estado,
    ordenRetiroId: v.ordenRetiroId,
    fechaEntrega: aIso(v.fechaEntrega)!,
    horaEntrega: v.horaEntrega,
    sitioEntregaId: v.sitioEntregaId,
    sitioEntrega: v.sitioEntrega.valor,
    formaPagoId: v.formaPagoId,
    formaPago: v.formaPago?.valor ?? null,
    tipoDocumentoId: v.tipoDocumentoId,
    tipoDocumento: v.tipoDocumento?.valor ?? null,
    camionId: v.camionId,
    camion: v.camion.patente,
    remolqueId: v.remolqueId,
    remolque: v.remolque?.patente ?? null,
    numeralInicialCamion: v.numeralInicialCamion,
    numeralFinalCamion: v.numeralFinalCamion,
    numeralInicialRemolque: v.numeralInicialRemolque,
    numeralFinalRemolque: v.numeralFinalRemolque,
    litrosCamion: v.litrosCamion,
    litrosRemolque: v.litrosRemolque,
    totalLitros: v.totalLitros,
    valorLitro: v.valorLitro,
    total: v.total,
    observaciones: v.observaciones,
    motivoAnulacion: v.motivoAnulacion,
    retiro: aResumenRetiro(v.ordenRetiro),
  };
}

/** Los numerales van en pares (inicial y final) y el final no puede ser menor que el inicial. */
function validarNumerales(dto: ValeCombustibleDtoIn) {
  const pares: [
    string,
    number | null | undefined,
    number | null | undefined,
  ][] = [
    ['camión', dto.numeralInicialCamion, dto.numeralFinalCamion],
    ['remolque', dto.numeralInicialRemolque, dto.numeralFinalRemolque],
  ];
  for (const [unidad, inicial, final] of pares) {
    const hayInicial = inicial !== null && inicial !== undefined;
    const hayFinal = final !== null && final !== undefined;
    if (hayInicial !== hayFinal)
      throw invalido(
        `Complete numeral inicial y final de la bomba del ${unidad}.`,
      );
    if (hayInicial && hayFinal && final! < inicial!) {
      throw invalido(
        `El numeral final de la bomba del ${unidad} no puede ser menor que el inicial.`,
      );
    }
  }
  if (dto.numeralInicialRemolque != null && !dto.remolqueId) {
    throw invalido(
      'Indique la patente del remolque para registrar sus numerales.',
    );
  }
}

@Injectable()
export class ValesCombustibleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly refs: ReferenciasService,
    private readonly secuencias: SecuenciasService,
    private readonly exportacion: ExportacionService,
  ) {}

  async listar(f: FiltroCombustible): Promise<ValeCombustibleDto[]> {
    const filas = await this.prisma.valeCombustible.findMany({
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

  async obtener(id: number): Promise<ValeCombustibleDto> {
    const v = await this.prisma.valeCombustible.findUnique({
      where: { id },
      include,
    });
    if (!v) throw noEncontrado('El vale de combustible');
    return aDto(v);
  }

  private async preparar(
    tx: Tx,
    dto: ValeCombustibleDtoIn,
    antes?: ValeCombustible,
  ) {
    validarNumerales(dto);
    await this.refs.catalogo(
      tx,
      dto.sitioEntregaId,
      'SITIO_ENTREGA',
      'Sitio de entrega',
      antes?.sitioEntregaId,
    );
    await this.refs.catalogoOpcional(
      tx,
      dto.formaPagoId,
      'FORMA_PAGO',
      'Forma de pago',
      antes?.formaPagoId,
    );
    await this.refs.catalogoOpcional(
      tx,
      dto.tipoDocumentoId,
      'TIPO_DOCUMENTO',
      'Tipo de documento',
      antes?.tipoDocumentoId,
    );
    await this.refs.movil(
      tx,
      dto.camionId,
      ['camion'],
      'Patente camión',
      antes?.camionId,
    );
    await this.refs.movil(
      tx,
      dto.remolqueId,
      ['chasis', 'thermo', 'plataforma'],
      'Patente remolque',
      antes?.remolqueId,
    );
    return {
      ...dto,
      ...calcularCombustible(dto),
      fechaEntrega: aFecha(dto.fechaEntrega)!,
    };
  }

  async crear(
    dto: ValeCombustibleDtoIn,
    u: UsuarioSesion,
  ): Promise<ValeCombustibleDto> {
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
      const datos = await this.preparar(tx, dto);
      const numero = await this.secuencias.siguiente(tx, 'VALE_COMBUSTIBLE');
      const v = await tx.valeCombustible.create({
        data: { ...datos, numero, creadoPorId: u.id, actualizadoPorId: u.id },
        include,
      });
      await this.auditoria.registrar(tx, {
        entidad: 'ValeCombustible',
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
    dto: ValeCombustibleDtoIn,
    u: UsuarioSesion,
  ): Promise<ValeCombustibleDto> {
    return this.prisma.$transaction(async (tx) => {
      const antes = await tx.valeCombustible.findUnique({ where: { id } });
      if (!antes) throw noEncontrado('El vale de combustible');
      if (antes.estado === 'ANULADO')
        throw conflicto('El vale está anulado y no se puede modificar.');
      if (dto.ordenRetiroId !== antes.ordenRetiroId)
        throw invalido(
          'No se puede cambiar la orden de retiro de un vale emitido.',
        );
      const datos = await this.preparar(tx, dto, antes);
      const v = await tx.valeCombustible.update({
        where: { id },
        data: { ...datos, actualizadoPorId: u.id },
        include,
      });
      await this.auditoria.registrar(tx, {
        entidad: 'ValeCombustible',
        entidadId: id,
        accion: 'EDITAR',
        usuarioId: u.id,
        cambios: this.auditoria.diferencias(antes, v),
      });
      return aDto(v);
    });
  }

  async anular(
    id: number,
    motivo: string,
    u: UsuarioSesion,
  ): Promise<ValeCombustibleDto> {
    return this.prisma.$transaction(async (tx) => {
      const antes = await tx.valeCombustible.findUnique({ where: { id } });
      if (!antes) throw noEncontrado('El vale de combustible');
      if (antes.estado === 'ANULADO')
        throw conflicto('El vale ya está anulado.');
      const v = await tx.valeCombustible.update({
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
        entidad: 'ValeCombustible',
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
        titulo: 'Orden de Entrega de Combustible',
        numero: v.numero,
        fecha: v.fechaEntrega,
        estado: etiquetaEstado(v.estado),
        anulado:
          v.estado === 'ANULADO' ? { motivo: v.motivoAnulacion } : undefined,
        nombreArchivo: `vale-combustible-${String(v.numero).padStart(6, '0')}`,
        secciones: [
          {
            titulo: 'Entrega',
            campos: [
              {
                etiqueta: 'Fecha de entrega',
                valor: v.fechaEntrega,
                tipo: 'fecha',
              },
              { etiqueta: 'Hora de entrega', valor: v.horaEntrega },
              { etiqueta: 'Sitio de entrega', valor: v.sitioEntrega },
              { etiqueta: 'Forma de pago', valor: v.formaPago },
              { etiqueta: 'Tipo de documento', valor: v.tipoDocumento },
            ],
          },
          seccionRetiro(v.retiro),
        ],
        tablas: [
          {
            titulo: 'Carga de combustible',
            columnas: [
              { campo: 'unidad', titulo: 'Unidad' },
              { campo: 'patente', titulo: 'Patente' },
              { campo: 'inicial', titulo: 'Numeral inicial', tipo: 'decimal' },
              { campo: 'final', titulo: 'Numeral final', tipo: 'decimal' },
              { campo: 'litros', titulo: 'Litros', tipo: 'decimal' },
            ],
            filas: [
              {
                unidad: 'Camión',
                patente: v.camion,
                inicial: v.numeralInicialCamion,
                final: v.numeralFinalCamion,
                litros: v.litrosCamion,
              },
              ...(v.remolque
                ? [
                    {
                      unidad: 'Remolque',
                      patente: v.remolque,
                      inicial: v.numeralInicialRemolque,
                      final: v.numeralFinalRemolque,
                      litros: v.litrosRemolque,
                    },
                  ]
                : []),
            ],
            totales: [
              {
                etiqueta: 'Total litros',
                valor: v.totalLitros,
                tipo: 'decimal',
              },
              { etiqueta: 'Valor litro', valor: v.valorLitro, tipo: 'pesos' },
              { etiqueta: 'Total', valor: v.total, tipo: 'pesos' },
            ],
          },
        ],
        observaciones: v.observaciones,
        firmas: ['Firma conductor', 'Firma despachador'],
      },
      formato,
    );
  }
}

@ApiTags('Documentos')
@Controller('vales-combustible')
export class ValesCombustibleController {
  constructor(private readonly servicio: ValesCombustibleService) {}

  @Get() listar(@Query() f: FiltroCombustible) {
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
  crear(@Body() dto: ValeCombustibleDtoIn, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.crear(dto, u);
  }

  @RequierePermiso('editarFinanzas')
  @Put(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ValeCombustibleDtoIn,
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
  controllers: [ValesCombustibleController],
  providers: [ValesCombustibleService],
})
export class ValesCombustibleModule {}
