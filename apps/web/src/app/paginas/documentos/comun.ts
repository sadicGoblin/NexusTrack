import type { OrdenRetiroDto, ResumenRetiroDto } from '@nexustrack/shared';
import type { ColumnaTabla } from '../../compartido/tabla/tabla-datos';

/** Resumen heredable a partir de una orden de retiro completa. */
export function aResumen(o: OrdenRetiroDto): ResumenRetiroDto {
  return {
    id: o.id,
    numero: o.numero,
    fecha: o.fecha,
    estado: o.estado,
    cliente: o.cliente,
    clienteId: o.clienteId,
    origen: o.origen,
    destino: o.destino,
    trazabilidad: o.trazabilidad,
    conductor: o.conductor,
    conductorId: o.conductorId,
    conductorRut: o.conductorRut,
    empresa: o.empresa,
    camion: o.camion,
    camionId: o.camionId,
    remolque: o.remolque,
    remolqueId: o.remolqueId,
    tipoRemolque: o.tipoRemolque,
    puertoEmbarque: o.puertoEmbarque,
    fechaEmbarque: o.fechaEmbarque,
    horaEmbarque: o.horaEmbarque,
    depositoRetiro: o.depositoRetiro,
    depositoEntrega: o.depositoEntrega,
    packingEntrega: o.packingEntrega,
    packingCarga: o.packingCarga,
    packingCargaId: o.packingCargaId,
    fechaCarga: o.fechaCarga,
    horaCarga: o.horaCarga,
    tieneOrdenCarga: !!o.ordenCargaId,
  };
}

export const COLUMNAS_RETIROS: ColumnaTabla[] = [
  { campo: 'numero', titulo: 'N°', tipo: 'correlativo', ancho: '6rem' },
  { campo: 'fecha', titulo: 'Fecha', tipo: 'fecha' },
  { campo: 'estado', titulo: 'Estado', tipo: 'estado' },
  { campo: 'cliente', titulo: 'Cliente', filtro: 'lista' },
  { campo: 'conductor', titulo: 'Conductor', filtro: 'lista' },
  { campo: 'camion', titulo: 'Camión', filtro: 'lista' },
  { campo: 'remolque', titulo: 'Remolque', filtro: 'lista' },
  { campo: 'origen', titulo: 'Origen', filtro: 'lista' },
  { campo: 'destino', titulo: 'Destino', filtro: 'lista' },
  { campo: 'fechaCarga', titulo: 'Fecha carga', tipo: 'fecha' },
];

export const COLUMNAS_CARGAS: ColumnaTabla[] = [
  { campo: 'numero', titulo: 'N°', tipo: 'correlativo', ancho: '6rem' },
  { campo: 'hojaRuta', titulo: 'Hoja de ruta', tipo: 'correlativo' },
  { campo: 'fechaCarga', titulo: 'Fecha carga', tipo: 'fecha' },
  { campo: 'cliente', titulo: 'Cliente', filtro: 'lista' },
  { campo: 'conductor', titulo: 'Conductor', filtro: 'lista' },
  { campo: 'patenteCamion', titulo: 'Camión', filtro: 'lista' },
  { campo: 'tramo', titulo: 'Tramo', filtro: 'lista' },
  { campo: 'totalNeto', titulo: 'Total neto', tipo: 'pesos' },
];
