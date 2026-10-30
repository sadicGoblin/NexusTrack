import { Injectable } from '@nestjs/common';
import {
  GRUPOS_MOVIL,
  type GrupoMovil,
  type TipoCatalogo,
} from '@nexustrack/shared';
import type { Tx } from '../prisma/prisma.service.js';
import { invalido } from './errores.js';

/**
 * Valida las referencias de un formulario antes de guardar: que existan, que sean del tipo
 * correcto y que estén activas. Un registro inactivo se acepta solo si ya estaba asignado
 * (parámetro `anterior`), para no impedir editar documentos históricos.
 */
@Injectable()
export class ReferenciasService {
  async catalogo(
    tx: Tx,
    id: number,
    tipo: TipoCatalogo,
    etiqueta: string,
    anterior?: number | null,
  ) {
    const item = await tx.catalogoItem.findUnique({ where: { id } });
    if (!item || item.tipo !== tipo)
      throw invalido(`${etiqueta}: el valor seleccionado no es válido.`);
    if (!item.activo && id !== anterior)
      throw invalido(`${etiqueta}: "${item.valor}" está desactivado.`);
    return item;
  }

  async catalogoOpcional(
    tx: Tx,
    id: number | null | undefined,
    tipo: TipoCatalogo,
    etiqueta: string,
    anterior?: number | null,
  ) {
    return id ? this.catalogo(tx, id, tipo, etiqueta, anterior) : null;
  }

  async empresa(tx: Tx, id: number, anterior?: number | null) {
    const e = await tx.empresa.findUnique({
      where: { id },
      include: { categoria: true },
    });
    if (!e) throw invalido('La empresa seleccionada no existe.');
    if (!e.activo && id !== anterior)
      throw invalido(`La empresa ${e.razonSocial} está inactiva.`);
    return e;
  }

  async cliente(tx: Tx, id: number, anterior?: number | null) {
    const c = await tx.cliente.findUnique({ where: { id } });
    if (!c) throw invalido('El cliente seleccionado no existe.');
    if (!c.activo && id !== anterior)
      throw invalido(`El cliente ${c.nombre} está inactivo.`);
    return c;
  }

  async packing(
    tx: Tx,
    id: number | null | undefined,
    etiqueta: string,
    anterior?: number | null,
  ) {
    if (!id) return null;
    const p = await tx.packing.findUnique({ where: { id } });
    if (!p) throw invalido(`${etiqueta}: el packing seleccionado no existe.`);
    if (!p.activo && id !== anterior)
      throw invalido(`${etiqueta}: el packing ${p.nombre} está inactivo.`);
    return p;
  }

  async conductor(tx: Tx, id: number, anterior?: number | null) {
    const c = await tx.conductor.findUnique({ where: { id } });
    if (!c) throw invalido('El conductor seleccionado no existe.');
    if (!c.activo && id !== anterior)
      throw invalido(`El conductor ${c.nombre} está inactivo.`);
    return c;
  }

  /** Móvil del grupo indicado (camión, chasis, thermo, plataforma o cualquier remolque). */
  async movil(
    tx: Tx,
    id: number | null | undefined,
    grupos: GrupoMovil[],
    etiqueta: string,
    anterior?: number | null,
  ) {
    if (!id) return null;
    const m = await tx.movil.findUnique({
      where: { id },
      include: { tipo: true },
    });
    if (!m) throw invalido(`${etiqueta}: el móvil seleccionado no existe.`);
    const permitidos = grupos.flatMap(
      (g) => GRUPOS_MOVIL[g] as readonly string[],
    );
    if (!m.tipo.codigo || !permitidos.includes(m.tipo.codigo)) {
      throw invalido(
        `${etiqueta}: la patente ${m.patente} es de tipo ${m.tipo.valor}, no corresponde.`,
      );
    }
    if (!m.activo && id !== anterior)
      throw invalido(`${etiqueta}: el móvil ${m.patente} está inactivo.`);
    return m;
  }
}
