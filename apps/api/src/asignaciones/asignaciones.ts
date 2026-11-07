import {
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Module,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  GRUPOS_MOVIL,
  hoyIso,
  remolqueSegunTrazabilidad,
  type AsignacionDto,
  type AsignacionInput,
  type SugerenciaAsignacionDto,
  type TableroAsignacionDto,
  type UsuarioSesion,
} from '@nexustrack/shared';
import { RequierePermiso, UsuarioActual } from '../comun/decoradores.js';
import { conflicto, invalido, noEncontrado } from '../comun/errores.js';
import { aFecha, aIso } from '../comun/fechas.js';
import { Fecha, Id } from '../comun/validacion.js';
import { AuditoriaService } from '../comun/auditoria.service.js';
import { ReferenciasService } from '../comun/referencias.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

class AsignacionDtoIn implements AsignacionInput {
  @Id('Camión') camionId!: number;
  @Id('Conductor', { opcional: true }) conductorId?: number | null;
  @Id('Chasis', { opcional: true }) chasisId?: number | null;
  @Id('Thermo', { opcional: true }) thermoId?: number | null;
  @Id('Plataforma', { opcional: true }) plataformaId?: number | null;
  @Fecha('Fecha de asignación') fechaAsignacion!: string;
}

class LiberarDtoIn {
  @Fecha('Fecha de término') fecha!: string;
}

class FiltroHistorial {
  @Id('Camión', { opcional: true }) camionId?: number;
}

class FiltroSugerencia {
  @Id('Conductor', { opcional: true }) conductorId?: number;
  @Id('Camión', { opcional: true }) camionId?: number;
  @Id('Trazabilidad', { opcional: true }) trazabilidadId?: number;
}

const include = {
  empresa: true,
  camion: { include: { tipo: true } },
  conductor: true,
  chasis: { include: { tipo: true } },
  thermo: { include: { tipo: true } },
  plataforma: { include: { tipo: true } },
} satisfies Prisma.AsignacionInclude;
type Fila = Prisma.AsignacionGetPayload<{ include: typeof include }>;

function aDto(a: Fila): AsignacionDto {
  return {
    id: a.id,
    empresaId: a.empresaId,
    empresa: a.empresa.razonSocial,
    camionId: a.camionId,
    camion: a.camion.patente,
    camionTipo: a.camion.tipo.valor,
    conductorId: a.conductorId,
    conductor: a.conductor?.nombre ?? null,
    chasisId: a.chasisId,
    chasis: a.chasis?.patente ?? null,
    thermoId: a.thermoId,
    thermo: a.thermo?.patente ?? null,
    plataformaId: a.plataformaId,
    plataforma: a.plataforma?.patente ?? null,
    fechaAsignacion: aIso(a.fechaAsignacion)!,
    fechaTermino: aIso(a.fechaTermino),
    vigente: a.fechaTermino === null,
  };
}

const CAMPOS = ['conductorId', 'chasisId', 'thermoId', 'plataformaId'] as const;

@Injectable()
export class AsignacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly refs: ReferenciasService,
  ) {}

  /** Todos los camiones activos con su asignación vigente. */
  async tablero(): Promise<TableroAsignacionDto[]> {
    const camiones = await this.prisma.movil.findMany({
      where: {
        activo: true,
        tipo: { codigo: { in: [...GRUPOS_MOVIL.camion] } },
      },
      include: {
        tipo: true,
        empresa: true,
        asignacionesCamion: { where: { fechaTermino: null }, include },
      },
      orderBy: [{ empresa: { razonSocial: 'asc' } }, { patente: 'asc' }],
    });
    return camiones.map((c) => ({
      camionId: c.id,
      camion: c.patente,
      camionTipo: c.tipo.valor,
      empresaId: c.empresaId,
      empresa: c.empresa.razonSocial,
      asignacion: c.asignacionesCamion[0]
        ? aDto(c.asignacionesCamion[0])
        : null,
    }));
  }

  async historial(f: FiltroHistorial): Promise<AsignacionDto[]> {
    const filas = await this.prisma.asignacion.findMany({
      where: { camionId: f.camionId },
      include,
      orderBy: [{ fechaAsignacion: 'desc' }, { id: 'desc' }],
      take: 500,
    });
    return filas.map(aDto);
  }

  /**
   * Autocompletado de la orden de retiro: desde un conductor (camión, empresa y remolque de su
   * asignación vigente) o desde un camión (sus remolques vigentes). Con trazabilidad, el remolque
   * es el del tipo que ella lleva (PLANTA-PUERTO, thermo; contenedores, chasis), o ninguno.
   */
  async sugerencia(f: FiltroSugerencia): Promise<SugerenciaAsignacionDto> {
    const trazabilidad = f.trazabilidadId
      ? await this.prisma.catalogoItem.findUnique({
          where: { id: f.trazabilidadId },
        })
      : null;
    const remolquePedido = remolqueSegunTrazabilidad(trazabilidad?.valor);
    const vacia: SugerenciaAsignacionDto = {
      empresaId: null,
      camionId: null,
      remolqueId: null,
      tipoRemolque: null,
      remolques: [],
      remolquePedido,
    };
    let asignacion: Fila | null = null;
    let empresaId: number | null = null;
    if (f.conductorId) {
      const conductor = await this.prisma.conductor.findUnique({
        where: { id: f.conductorId },
      });
      empresaId = conductor?.empresaId ?? null;
      asignacion = await this.prisma.asignacion.findFirst({
        where: { conductorId: f.conductorId, fechaTermino: null },
        include,
      });
    } else if (f.camionId) {
      asignacion = await this.prisma.asignacion.findFirst({
        where: { camionId: f.camionId, fechaTermino: null },
        include,
      });
      empresaId =
        asignacion?.empresaId ??
        (await this.prisma.movil.findUnique({ where: { id: f.camionId } }))
          ?.empresaId ??
        null;
    }
    if (!asignacion) return { ...vacia, empresaId };
    const remolques = (
      [
        ['thermo', asignacion.thermo],
        ['chasis', asignacion.chasis],
        ['plataforma', asignacion.plataforma],
      ] as const
    ).flatMap(([grupo, m]) =>
      m ? [{ id: m.id, patente: m.patente, tipo: m.tipo.valor, grupo }] : [],
    );
    const elegido = remolquePedido
      ? remolques.find((r) => r.grupo === remolquePedido)
      : remolques[0];
    return {
      empresaId: empresaId ?? asignacion.empresaId,
      camionId: asignacion.camionId,
      remolqueId: elegido?.id ?? null,
      tipoRemolque: elegido?.tipo ?? null,
      remolques,
      remolquePedido,
    };
  }

  /**
   * Cambia la configuración de un camión: cierra la asignación vigente (si existe) con la fecha
   * indicada y crea una nueva. Si no hay cambios, devuelve la vigente sin modificar nada.
   */
  async asignar(
    dto: AsignacionDtoIn,
    u: UsuarioSesion,
  ): Promise<AsignacionDto> {
    return this.prisma.$transaction(async (tx) => {
      const camion = await this.refs.movil(
        tx,
        dto.camionId,
        ['camion'],
        'Camión',
      );
      const vigente = await tx.asignacion.findFirst({
        where: { camionId: dto.camionId, fechaTermino: null },
        include,
      });
      if (
        vigente &&
        CAMPOS.every((c) => (vigente[c] ?? null) === (dto[c] ?? null))
      )
        return aDto(vigente);
      if (vigente && aIso(vigente.fechaAsignacion)! > dto.fechaAsignacion) {
        throw invalido(
          `La fecha no puede ser anterior a la asignación vigente (${aIso(vigente.fechaAsignacion)}).`,
        );
      }

      if (dto.conductorId)
        await this.refs.conductor(tx, dto.conductorId, vigente?.conductorId);
      await this.refs.movil(
        tx,
        dto.chasisId,
        ['chasis'],
        'Chasis',
        vigente?.chasisId,
      );
      await this.refs.movil(
        tx,
        dto.thermoId,
        ['thermo'],
        'Thermo',
        vigente?.thermoId,
      );
      await this.refs.movil(
        tx,
        dto.plataformaId,
        ['plataforma'],
        'Plataforma',
        vigente?.plataformaId,
      );
      await this.verificarDisponibles(tx, dto);

      if (vigente) {
        await tx.asignacion.update({
          where: { id: vigente.id },
          data: {
            fechaTermino: aFecha(dto.fechaAsignacion),
            actualizadoPorId: u.id,
          },
        });
      }
      const nueva = await tx.asignacion.create({
        data: {
          empresaId: camion!.empresaId,
          camionId: dto.camionId,
          conductorId: dto.conductorId ?? null,
          chasisId: dto.chasisId ?? null,
          thermoId: dto.thermoId ?? null,
          plataformaId: dto.plataformaId ?? null,
          fechaAsignacion: aFecha(dto.fechaAsignacion)!,
          creadoPorId: u.id,
          actualizadoPorId: u.id,
        },
        include,
      });
      await this.auditoria.registrar(tx, {
        entidad: 'Asignacion',
        entidadId: nueva.id,
        accion: 'ASIGNAR',
        usuarioId: u.id,
        cambios: {
          camion: camion!.patente,
          anterior: vigente
            ? {
                conductor: vigente.conductor?.nombre ?? null,
                chasis: vigente.chasis?.patente ?? null,
                thermo: vigente.thermo?.patente ?? null,
                plataforma: vigente.plataforma?.patente ?? null,
              }
            : null,
          nueva: {
            conductor: nueva.conductor?.nombre ?? null,
            chasis: nueva.chasis?.patente ?? null,
            thermo: nueva.thermo?.patente ?? null,
            plataforma: nueva.plataforma?.patente ?? null,
          },
        },
      });
      return aDto(nueva);
    });
  }

  /** Deja el camión sin asignación vigente. */
  async liberar(
    camionId: number,
    fecha: string,
    u: UsuarioSesion,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const vigente = await tx.asignacion.findFirst({
        where: { camionId, fechaTermino: null },
      });
      if (!vigente) throw noEncontrado('La asignación vigente del camión');
      if (aIso(vigente.fechaAsignacion)! > fecha)
        throw invalido(
          'La fecha de término no puede ser anterior a la fecha de asignación.',
        );
      await tx.asignacion.update({
        where: { id: vigente.id },
        data: { fechaTermino: aFecha(fecha), actualizadoPorId: u.id },
      });
      await this.auditoria.registrar(tx, {
        entidad: 'Asignacion',
        entidadId: vigente.id,
        accion: 'EDITAR',
        usuarioId: u.id,
        cambios: { fechaTermino: { antes: null, despues: fecha } },
      });
    });
  }

  /** Mensaje claro cuando un conductor o remolque ya está en otro camión. */
  private async verificarDisponibles(tx: Tx, dto: AsignacionDtoIn) {
    const etiquetas: Record<(typeof CAMPOS)[number], string> = {
      conductorId: 'El conductor',
      chasisId: 'El chasis',
      thermoId: 'El thermo',
      plataformaId: 'La plataforma',
    };
    for (const campo of CAMPOS) {
      const id = dto[campo];
      if (!id) continue;
      const otra = await tx.asignacion.findFirst({
        where: {
          [campo]: id,
          fechaTermino: null,
          camionId: { not: dto.camionId },
        },
        include: { camion: true },
      });
      if (otra)
        throw conflicto(
          `${etiquetas[campo]} ya está asignado al camión ${otra.camion.patente}. Libérelo primero.`,
        );
    }
  }
}

@ApiTags('Mantenedores')
@Controller('asignaciones')
export class AsignacionesController {
  constructor(private readonly servicio: AsignacionesService) {}

  @Get('tablero') tablero() {
    return this.servicio.tablero();
  }

  @Get('sugerencia') sugerencia(@Query() f: FiltroSugerencia) {
    return this.servicio.sugerencia(f);
  }

  @Get() historial(@Query() f: FiltroHistorial) {
    return this.servicio.historial(f);
  }

  @RequierePermiso('editarMantenedores')
  @Post()
  asignar(@Body() dto: AsignacionDtoIn, @UsuarioActual() u: UsuarioSesion) {
    return this.servicio.asignar(dto, u);
  }

  @RequierePermiso('editarMantenedores')
  @Post('camion/:camionId/liberar')
  @HttpCode(204)
  liberar(
    @Param('camionId', ParseIntPipe) camionId: number,
    @Body() dto: LiberarDtoIn,
    @UsuarioActual() u: UsuarioSesion,
  ) {
    return this.servicio.liberar(camionId, dto.fecha ?? hoyIso(), u);
  }
}

@Module({
  controllers: [AsignacionesController],
  providers: [AsignacionesService],
})
export class AsignacionesModule {}
