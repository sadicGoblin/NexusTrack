import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuditoriaDto } from '@nexustrack/shared';
import { RequierePermiso } from '../comun/decoradores.js';
import { FiltroFechasDto } from '../comun/dto.js';
import { Entero, Texto } from '../comun/validacion.js';
import { PrismaService } from '../prisma/prisma.service.js';

class FiltroAuditoria extends FiltroFechasDto {
  @Texto('Entidad', { opcional: true, max: 60 }) entidad?: string;
  @Entero('Id de entidad', { opcional: true, min: 0 }) entidadId?: number;
}

type Buscador = (ids: number[]) => Promise<Map<number, string>>;

const correlativo = (numero: number) => `N° ${String(numero).padStart(6, '0')}`;

function mapa<T extends { id: number }>(
  filas: T[],
  texto: (fila: T) => string,
): Map<number, string> {
  return new Map(filas.map((f) => [f.id, texto(f)]));
}

/** Referencia guardada en la copia del registro (al crearlo o al eliminarlo). */
function desdeCopia(cambios: unknown): string | null {
  if (!cambios || typeof cambios !== 'object') return null;
  const c = cambios as Record<string, unknown>;
  if (typeof c['numero'] === 'number') return correlativo(c['numero']);
  for (const campo of ['patente', 'razonSocial', 'nombre', 'valor', 'codigo'])
    if (typeof c[campo] === 'string') return c[campo];
  return null;
}

@ApiTags('Administración')
@RequierePermiso('administrar')
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly prisma: PrismaService) {}

  /** Cómo encontrar la referencia legible de cada tipo de registro. */
  private readonly buscadores: Record<string, Buscador> = {
    OrdenRetiro: async (ids) =>
      mapa(
        await this.prisma.ordenRetiro.findMany({
          where: { id: { in: ids } },
          select: { id: true, numero: true },
        }),
        (x) => correlativo(x.numero),
      ),
    OrdenCarga: async (ids) =>
      mapa(
        await this.prisma.ordenCarga.findMany({
          where: { id: { in: ids } },
          select: { id: true, numero: true },
        }),
        (x) => correlativo(x.numero),
      ),
    ValeDinero: async (ids) =>
      mapa(
        await this.prisma.valeDinero.findMany({
          where: { id: { in: ids } },
          select: { id: true, numero: true },
        }),
        (x) => correlativo(x.numero),
      ),
    ValeCombustible: async (ids) =>
      mapa(
        await this.prisma.valeCombustible.findMany({
          where: { id: { in: ids } },
          select: { id: true, numero: true },
        }),
        (x) => correlativo(x.numero),
      ),
    Rendicion: async (ids) =>
      mapa(
        await this.prisma.rendicion.findMany({
          where: { id: { in: ids } },
          select: { id: true, numero: true },
        }),
        (x) => correlativo(x.numero),
      ),
    Empresa: async (ids) =>
      mapa(
        await this.prisma.empresa.findMany({
          where: { id: { in: ids } },
          select: { id: true, razonSocial: true },
        }),
        (x) => x.razonSocial,
      ),
    Cliente: async (ids) =>
      mapa(
        await this.prisma.cliente.findMany({
          where: { id: { in: ids } },
          select: { id: true, nombre: true },
        }),
        (x) => x.nombre,
      ),
    Packing: async (ids) =>
      mapa(
        await this.prisma.packing.findMany({
          where: { id: { in: ids } },
          select: { id: true, nombre: true },
        }),
        (x) => x.nombre,
      ),
    Movil: async (ids) =>
      mapa(
        await this.prisma.movil.findMany({
          where: { id: { in: ids } },
          select: { id: true, patente: true },
        }),
        (x) => x.patente,
      ),
    Conductor: async (ids) =>
      mapa(
        await this.prisma.conductor.findMany({
          where: { id: { in: ids } },
          select: { id: true, nombre: true },
        }),
        (x) => x.nombre,
      ),
    Asignacion: async (ids) =>
      mapa(
        await this.prisma.asignacion.findMany({
          where: { id: { in: ids } },
          select: { id: true, camion: { select: { patente: true } } },
        }),
        (x) => `Camión ${x.camion.patente}`,
      ),
    RutaTarifa: async (ids) =>
      mapa(
        await this.prisma.rutaTarifa.findMany({
          where: { id: { in: ids } },
          select: { id: true, codigo: true, tramo: true },
        }),
        (x) => `${x.codigo} · ${x.tramo}`,
      ),
    CatalogoItem: async (ids) =>
      mapa(
        await this.prisma.catalogoItem.findMany({
          where: { id: { in: ids } },
          select: { id: true, valor: true },
        }),
        (x) => x.valor,
      ),
    Usuario: async (ids) =>
      mapa(
        await this.prisma.usuario.findMany({
          where: { id: { in: ids } },
          select: { id: true, nombre: true },
        }),
        (x) => x.nombre,
      ),
  };

  @Get()
  async listar(@Query() f: FiltroAuditoria): Promise<AuditoriaDto[]> {
    const filas = await this.prisma.auditoria.findMany({
      where: {
        entidad: f.entidad ?? undefined,
        entidadId: f.entidadId ?? undefined,
        fecha: {
          ...(f.desde ? { gte: new Date(`${f.desde}T00:00:00-03:00`) } : {}),
          ...(f.hasta
            ? { lte: new Date(`${f.hasta}T23:59:59.999-03:00`) }
            : {}),
        },
      },
      include: { usuario: { select: { nombre: true } } },
      orderBy: { id: 'desc' },
      take: 2000,
    });

    // Referencias de los registros que siguen existiendo.
    const porEntidad = new Map<string, Set<number>>();
    for (const a of filas) {
      if (!this.buscadores[a.entidad]) continue;
      if (!porEntidad.has(a.entidad)) porEntidad.set(a.entidad, new Set());
      porEntidad.get(a.entidad)!.add(a.entidadId);
    }
    const existentes = new Map<string, Map<number, string>>();
    await Promise.all(
      [...porEntidad].map(async ([entidad, ids]) =>
        existentes.set(entidad, await this.buscadores[entidad]([...ids])),
      ),
    );

    // Los eliminados se reconocen por la copia que quedó al eliminarlos.
    const faltantes = filas.filter(
      (a) =>
        this.buscadores[a.entidad] &&
        !existentes.get(a.entidad)?.has(a.entidadId),
    );
    const copias = new Map<string, string | null>();
    if (faltantes.length) {
      const eliminaciones = await this.prisma.auditoria.findMany({
        where: {
          accion: { in: ['ELIMINAR', 'CREAR'] },
          OR: faltantes.map((a) => ({
            entidad: a.entidad,
            entidadId: a.entidadId,
          })),
        },
        select: { entidad: true, entidadId: true, cambios: true },
      });
      for (const e of eliminaciones) {
        const ref = desdeCopia(e.cambios);
        if (ref) copias.set(`${e.entidad}#${e.entidadId}`, ref);
      }
    }

    return filas.map((a) => {
      const vigente = existentes.get(a.entidad)?.get(a.entidadId);
      const referencia =
        a.entidad === 'Parametro'
          ? (Object.keys((a.cambios as object | null) ?? {})[0] ?? null)
          : (vigente ??
            copias.get(`${a.entidad}#${a.entidadId}`) ??
            desdeCopia(a.cambios));
      return {
        id: a.id,
        entidad: a.entidad,
        entidadId: a.entidadId,
        referencia,
        eliminado: !!this.buscadores[a.entidad] && vigente === undefined,
        accion: a.accion,
        usuario: a.usuario?.nombre ?? null,
        fecha: a.fecha.toISOString(),
        cambios: a.cambios,
      };
    });
  }
}
