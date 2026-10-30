import {
  ESTADO_ETIQUETA,
  type OrdenRetiroDto,
  type ResumenRetiroDto,
} from '@nexustrack/shared';
import { aIso } from '../comun/fechas.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { DocumentoImprimible } from '../exportacion/tipos.js';

/** Relaciones necesarias para mostrar una orden de retiro y heredar sus datos. */
export const includeRetiro = {
  trazabilidad: true,
  conductor: true,
  camion: true,
  remolque: { include: { tipo: true } },
  empresa: true,
  cliente: true,
  origen: true,
  destino: true,
  depositoRetiro: true,
  packingCarga: true,
  depositoEntrega: true,
  packingEntrega: true,
  puertoEmbarque: true,
  ordenesCarga: {
    where: { estado: { not: 'ANULADA' } },
    select: { id: true, numero: true },
  },
  _count: {
    select: {
      valesDinero: { where: { estado: 'EMITIDO' } },
      valesCombustible: { where: { estado: 'EMITIDO' } },
    },
  },
} satisfies Prisma.OrdenRetiroInclude;

export type FilaRetiro = Prisma.OrdenRetiroGetPayload<{
  include: typeof includeRetiro;
}>;

export function aResumenRetiro(o: FilaRetiro): ResumenRetiroDto {
  return {
    id: o.id,
    numero: o.numero,
    fecha: aIso(o.fecha)!,
    estado: o.estado,
    cliente: o.cliente.nombre,
    clienteId: o.clienteId,
    origen: o.origen.valor,
    destino: o.destino.valor,
    trazabilidad: o.trazabilidad.valor,
    conductor: o.conductor.nombre,
    conductorRut: o.conductor.rut,
    empresa: o.empresa.razonSocial,
    camion: o.camion.patente,
    camionId: o.camionId,
    remolque: o.remolque?.patente ?? null,
    remolqueId: o.remolqueId,
    tipoRemolque: o.tipoRemolque,
    puertoEmbarque: o.puertoEmbarque?.valor ?? null,
    fechaEmbarque: aIso(o.fechaEmbarque),
    horaEmbarque: o.horaEmbarque,
    depositoRetiro: o.depositoRetiro?.valor ?? null,
    depositoEntrega: o.depositoEntrega?.valor ?? null,
    packingEntrega: o.packingEntrega?.nombre ?? null,
    packingCarga: o.packingCarga?.nombre ?? null,
    packingCargaId: o.packingCargaId,
    fechaCarga: aIso(o.fechaCarga),
    horaCarga: o.horaCarga,
    tieneOrdenCarga: o.ordenesCarga.length > 0,
  };
}

export function aOrdenRetiroDto(o: FilaRetiro): OrdenRetiroDto {
  return {
    id: o.id,
    numero: o.numero,
    estado: o.estado,
    fecha: aIso(o.fecha)!,
    trazabilidadId: o.trazabilidadId,
    trazabilidad: o.trazabilidad.valor,
    conductorId: o.conductorId,
    conductor: o.conductor.nombre,
    conductorRut: o.conductor.rut,
    camionId: o.camionId,
    camion: o.camion.patente,
    remolqueId: o.remolqueId,
    remolque: o.remolque?.patente ?? null,
    tipoRemolque: o.tipoRemolque,
    empresaId: o.empresaId,
    empresa: o.empresa.razonSocial,
    empresaRut: o.empresa.rut,
    clienteId: o.clienteId,
    cliente: o.cliente.nombre,
    clienteRut: o.cliente.rut,
    origenId: o.origenId,
    origen: o.origen.valor,
    destinoId: o.destinoId,
    destino: o.destino.valor,
    depositoRetiroId: o.depositoRetiroId,
    depositoRetiro: o.depositoRetiro?.valor ?? null,
    packingCargaId: o.packingCargaId,
    packingCarga: o.packingCarga?.nombre ?? null,
    fechaCarga: aIso(o.fechaCarga),
    horaCarga: o.horaCarga,
    depositoEntregaId: o.depositoEntregaId,
    depositoEntrega: o.depositoEntrega?.valor ?? null,
    packingEntregaId: o.packingEntregaId,
    packingEntrega: o.packingEntrega?.nombre ?? null,
    destinoFinal: o.destinoFinal,
    nave: o.nave,
    mtb: o.mtb,
    booking: o.booking,
    puertoEmbarqueId: o.puertoEmbarqueId,
    puertoEmbarque: o.puertoEmbarque?.valor ?? null,
    fechaEmbarque: aIso(o.fechaEmbarque),
    horaEmbarque: o.horaEmbarque,
    opNumero: o.opNumero,
    ordenCompra: o.ordenCompra,
    observaciones: o.observaciones,
    motivoAnulacion: o.motivoAnulacion,
    ordenCargaNumero: o.ordenesCarga[0]?.numero ?? null,
    ordenCargaId: o.ordenesCarga[0]?.id ?? null,
    cantidadValesDinero: o._count.valesDinero,
    cantidadValesCombustible: o._count.valesCombustible,
    creadoEn: o.creadoEn.toISOString(),
  };
}

/** Campos de la orden de retiro que se imprimen en los documentos hijos. */
export function seccionRetiro(
  r: ResumenRetiroDto,
): DocumentoImprimible['secciones'][number] {
  return {
    titulo: `Orden de retiro N° ${String(r.numero).padStart(6, '0')}`,
    campos: [
      { etiqueta: 'Fecha orden de retiro', valor: r.fecha, tipo: 'fecha' },
      { etiqueta: 'Cliente', valor: r.cliente },
      { etiqueta: 'Trazabilidad', valor: r.trazabilidad, ancho: 2 },
      { etiqueta: 'Origen', valor: r.origen },
      { etiqueta: 'Destino', valor: r.destino },
      { etiqueta: 'Conductor', valor: r.conductor },
      { etiqueta: 'RUT conductor', valor: r.conductorRut },
      { etiqueta: 'Empresa', valor: r.empresa, ancho: 2 },
      { etiqueta: 'Patente camión', valor: r.camion },
      { etiqueta: 'Patente remolque', valor: r.remolque },
    ],
  };
}

export const etiquetaEstado = (e: keyof typeof ESTADO_ETIQUETA) =>
  ESTADO_ETIQUETA[e];
