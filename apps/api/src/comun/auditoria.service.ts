import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import type { Tx } from '../prisma/prisma.service.js';

export type AccionAuditoria = 'CREAR' | 'EDITAR' | 'ANULAR' | 'ASIGNAR';

const IGNORAR = new Set([
  'creadoEn',
  'actualizadoEn',
  'creadoPorId',
  'actualizadoPorId',
  'passwordHash',
  'versionToken',
]);

function normalizar(valor: unknown): unknown {
  if (valor instanceof Date) return valor.toISOString();
  return valor ?? null;
}

/** Registro de cambios por entidad. Se escribe dentro de la misma transacción del cambio. */
@Injectable()
export class AuditoriaService {
  async registrar(
    tx: Tx,
    datos: {
      entidad: string;
      entidadId: number;
      accion: AccionAuditoria;
      usuarioId: number;
      cambios?: unknown;
    },
  ): Promise<void> {
    await tx.auditoria.create({
      data: {
        entidad: datos.entidad,
        entidadId: datos.entidadId,
        accion: datos.accion,
        usuarioId: datos.usuarioId,
        cambios: (datos.cambios ?? undefined) as
          Prisma.InputJsonValue | undefined,
      },
    });
  }

  /** Campos que cambiaron entre dos versiones de un registro: { campo: { antes, despues } }. */
  diferencias(
    antes: object,
    despues: object,
  ): Record<string, { antes: unknown; despues: unknown }> {
    const a = antes as Record<string, unknown>;
    const d = despues as Record<string, unknown>;
    const cambios: Record<string, { antes: unknown; despues: unknown }> = {};
    for (const campo of Object.keys(d)) {
      if (
        IGNORAR.has(campo) ||
        (typeof d[campo] === 'object' &&
          d[campo] !== null &&
          !(d[campo] instanceof Date))
      )
        continue;
      const va = normalizar(a[campo]);
      const vd = normalizar(d[campo]);
      if (JSON.stringify(va) !== JSON.stringify(vd))
        cambios[campo] = { antes: va, despues: vd };
    }
    return cambios;
  }

  /** Copia plana de un registro para guardarla como "creado". */
  instantanea(registro: object): Record<string, unknown> {
    const r = registro as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(r)
        .filter(
          ([k, v]) =>
            !IGNORAR.has(k) &&
            (typeof v !== 'object' || v === null || v instanceof Date),
        )
        .map(([k, v]) => [k, normalizar(v)]),
    );
  }
}
