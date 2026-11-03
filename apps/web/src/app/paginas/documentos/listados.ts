import { Component } from '@angular/core';
import {
  TIPO_RENDICION_ETIQUETA,
  type HojaRutaDto,
  type OrdenCargaDto,
  type RendicionDto,
  type ValeCombustibleDto,
  type ValeDineroDto,
} from '@nexustrack/shared';
import {
  ListadoDocumentos,
  type ConfigListado,
} from '../../compartido/documentos/listado-documentos';

@Component({
  selector: 'nt-lista-ordenes-retiro',
  imports: [ListadoDocumentos],
  template: `<nt-listado-documentos [config]="config" />`,
})
export class ListaOrdenesRetiro {
  readonly config: ConfigListado = {
    titulo: 'Órdenes de retiro',
    descripcion:
      'Primer documento de cada flete. Desde aquí se emiten la orden de carga y los vales.',
    recurso: 'ordenes-retiro',
    claveEstado: 'ordenes-retiro',
    estados: ['ABIERTA', 'CON_CARGA', 'CERRADA', 'ANULADA'],
    todos: 'Todas',
    etiquetaNuevo: 'Nueva orden de retiro',
    permisoNuevo: 'editarOperacion',
    columnas: [
      { campo: 'numero', titulo: 'N°', tipo: 'correlativo', ancho: '6rem' },
      { campo: 'fecha', titulo: 'Fecha', tipo: 'fecha' },
      { campo: 'estado', titulo: 'Estado', tipo: 'estado' },
      { campo: 'cliente', titulo: 'Cliente', filtro: 'lista' },
      { campo: 'trazabilidad', titulo: 'Trazabilidad', filtro: 'lista' },
      { campo: 'origen', titulo: 'Origen', filtro: 'lista' },
      { campo: 'destino', titulo: 'Destino', filtro: 'lista' },
      { campo: 'conductor', titulo: 'Conductor', filtro: 'lista', ancho: '12rem' },
      { campo: 'camion', titulo: 'Camión', filtro: 'lista' },
      { campo: 'remolque', titulo: 'Remolque', filtro: 'lista' },
      { campo: 'empresa', titulo: 'Empresa', filtro: 'lista', oculta: true },
      { campo: 'fechaCarga', titulo: 'Fecha carga', tipo: 'fecha' },
      { campo: 'puertoEmbarque', titulo: 'Puerto', filtro: 'lista', oculta: true },
      { campo: 'nave', titulo: 'Nave', oculta: true },
      { campo: 'booking', titulo: 'Booking', oculta: true },
      { campo: 'ordenCargaNumero', titulo: 'Orden carga', tipo: 'correlativo' },
    ],
  };
}

@Component({
  selector: 'nt-lista-ordenes-carga',
  imports: [ListadoDocumentos],
  template: `<nt-listado-documentos [config]="config" />`,
})
export class ListaOrdenesCarga {
  readonly config: ConfigListado = {
    titulo: 'Órdenes de carga',
    descripcion:
      'Guías del flete valorizadas según las tarifas del cliente. El listado se filtra por fecha de carga.',
    recurso: 'ordenes-carga',
    claveEstado: 'ordenes-carga',
    estados: ['ABIERTA', 'RENDIDA', 'ANULADA'],
    todos: 'Todas',
    etiquetaNuevo: 'Nueva orden de carga',
    permisoNuevo: 'editarOperacion',
    aplanar: (o: OrdenCargaDto) => ({
      id: o.id,
      numero: o.numero,
      hojaRuta: o.hojaRuta,
      fechaCarga: o.fechaCarga,
      estado: o.estado,
      retiro: o.retiro.numero,
      cliente: o.retiro.cliente,
      conductor: o.retiro.conductor,
      patenteCamion: o.patenteCamion,
      patenteRemolque: o.patenteRemolque,
      tramo: o.tramo,
      guias: o.guias.length,
      totalNeto: o.totalNeto,
      rendicion: o.rendicionNumero,
    }),
    columnas: [
      { campo: 'numero', titulo: 'N°', tipo: 'correlativo', ancho: '6rem' },
      { campo: 'hojaRuta', titulo: 'Hoja de ruta', tipo: 'correlativo' },
      { campo: 'fechaCarga', titulo: 'Fecha carga', tipo: 'fecha' },
      { campo: 'estado', titulo: 'Estado', tipo: 'estado' },
      { campo: 'retiro', titulo: 'Orden retiro', tipo: 'correlativo' },
      { campo: 'cliente', titulo: 'Cliente', filtro: 'lista' },
      { campo: 'conductor', titulo: 'Conductor', filtro: 'lista' },
      { campo: 'patenteCamion', titulo: 'Camión', filtro: 'lista' },
      { campo: 'patenteRemolque', titulo: 'Remolque', filtro: 'lista' },
      { campo: 'tramo', titulo: 'Tramo', filtro: 'lista', ancho: '16rem' },
      { campo: 'guias', titulo: 'Guías', tipo: 'numero' },
      { campo: 'totalNeto', titulo: 'Total neto', tipo: 'pesos' },
      { campo: 'rendicion', titulo: 'Rendición', tipo: 'correlativo', oculta: true },
    ],
  };
}

@Component({
  selector: 'nt-lista-vales-dinero',
  imports: [ListadoDocumentos],
  template: `<nt-listado-documentos [config]="config" />`,
})
export class ListaValesDinero {
  readonly config: ConfigListado = {
    titulo: 'Vales de dinero',
    descripcion: 'Anticipos entregados a los conductores para cada viaje.',
    recurso: 'vales-dinero',
    claveEstado: 'vales-dinero',
    estados: ['EMITIDO', 'ANULADO'],
    todos: 'Todos',
    etiquetaNuevo: 'Nuevo vale de dinero',
    permisoNuevo: 'editarFinanzas',
    aplanar: (v: ValeDineroDto) => ({
      id: v.id,
      numero: v.numero,
      fechaEntrega: v.fechaEntrega,
      estado: v.estado,
      retiro: v.retiro?.numero ?? null,
      estadia: v.estadia?.numero ?? null,
      conductor: v.retiro?.conductor ?? v.estadia?.conductor,
      cliente: v.retiro?.cliente ?? null,
      camion: v.retiro?.camion ?? v.estadia?.camion,
      concepto: v.concepto,
      sitioEntrega: v.sitioEntrega,
      formaPago: v.formaPago,
      monto: v.monto,
      glosa: v.glosa,
    }),
    columnas: [
      { campo: 'numero', titulo: 'N°', tipo: 'correlativo', ancho: '6rem' },
      { campo: 'fechaEntrega', titulo: 'Fecha entrega', tipo: 'fecha' },
      { campo: 'estado', titulo: 'Estado', tipo: 'estado' },
      { campo: 'retiro', titulo: 'Orden retiro', tipo: 'correlativo' },
      { campo: 'estadia', titulo: 'Estadía', tipo: 'correlativo' },
      { campo: 'conductor', titulo: 'Conductor', filtro: 'lista' },
      { campo: 'cliente', titulo: 'Cliente', filtro: 'lista' },
      { campo: 'camion', titulo: 'Camión', filtro: 'lista', oculta: true },
      { campo: 'concepto', titulo: 'Concepto', filtro: 'lista' },
      { campo: 'sitioEntrega', titulo: 'Sitio entrega', filtro: 'lista' },
      { campo: 'formaPago', titulo: 'Forma de pago', filtro: 'lista' },
      { campo: 'monto', titulo: 'Monto', tipo: 'pesos' },
      { campo: 'glosa', titulo: 'Glosa', oculta: true },
    ],
  };
}

@Component({
  selector: 'nt-lista-vales-combustible',
  imports: [ListadoDocumentos],
  template: `<nt-listado-documentos [config]="config" />`,
})
export class ListaValesCombustible {
  readonly config: ConfigListado = {
    titulo: 'Vales de combustible',
    descripcion: 'Órdenes de entrega de combustible al terminar cada flete.',
    recurso: 'vales-combustible',
    claveEstado: 'vales-combustible',
    estados: ['EMITIDO', 'ANULADO'],
    todos: 'Todos',
    etiquetaNuevo: 'Nuevo vale de combustible',
    permisoNuevo: 'editarFinanzas',
    aplanar: (v: ValeCombustibleDto) => ({
      id: v.id,
      numero: v.numero,
      fechaEntrega: v.fechaEntrega,
      horaEntrega: v.horaEntrega,
      estado: v.estado,
      retiro: v.retiro.numero,
      conductor: v.retiro.conductor,
      cliente: v.retiro.cliente,
      camion: v.camion,
      remolque: v.remolque,
      sitioEntrega: v.sitioEntrega,
      formaPago: v.formaPago,
      tipoDocumento: v.tipoDocumento,
      litrosCamion: v.litrosCamion,
      litrosRemolque: v.litrosRemolque,
      totalLitros: v.totalLitros,
      valorLitro: v.valorLitro,
      total: v.total,
    }),
    columnas: [
      { campo: 'numero', titulo: 'N°', tipo: 'correlativo', ancho: '6rem' },
      { campo: 'fechaEntrega', titulo: 'Fecha entrega', tipo: 'fecha' },
      { campo: 'horaEntrega', titulo: 'Hora', oculta: true },
      { campo: 'estado', titulo: 'Estado', tipo: 'estado' },
      { campo: 'retiro', titulo: 'Orden retiro', tipo: 'correlativo' },
      { campo: 'conductor', titulo: 'Conductor', filtro: 'lista' },
      { campo: 'cliente', titulo: 'Cliente', filtro: 'lista', oculta: true },
      { campo: 'camion', titulo: 'Camión', filtro: 'lista' },
      { campo: 'remolque', titulo: 'Remolque', filtro: 'lista' },
      { campo: 'sitioEntrega', titulo: 'Sitio entrega', filtro: 'lista' },
      { campo: 'formaPago', titulo: 'Forma de pago', filtro: 'lista', oculta: true },
      { campo: 'tipoDocumento', titulo: 'Tipo documento', filtro: 'lista', oculta: true },
      { campo: 'litrosCamion', titulo: 'Litros camión', tipo: 'decimal', oculta: true },
      { campo: 'litrosRemolque', titulo: 'Litros remolque', tipo: 'decimal', oculta: true },
      { campo: 'totalLitros', titulo: 'Total litros', tipo: 'decimal' },
      { campo: 'valorLitro', titulo: 'Valor litro', tipo: 'pesos' },
      { campo: 'total', titulo: 'Total', tipo: 'pesos' },
    ],
  };
}

@Component({
  selector: 'nt-lista-rendiciones',
  imports: [ListadoDocumentos],
  template: `<nt-listado-documentos [config]="config" />`,
})
export class ListaRendiciones {
  readonly config: ConfigListado = {
    titulo: 'Rendiciones',
    descripcion:
      'Rendición de gastos y viáticos de cada orden de carga y de cada estadía (mismo correlativo).',
    recurso: 'rendiciones',
    claveEstado: 'rendiciones',
    estados: ['EMITIDO', 'ANULADO'],
    todos: 'Todas',
    etiquetaNuevo: 'Nueva rendición',
    permisoNuevo: 'editarFinanzas',
    aplanar: (r: RendicionDto) => ({
      id: r.id,
      numero: r.numero,
      fecha: r.fecha,
      estado: r.estado,
      tipo: TIPO_RENDICION_ETIQUETA[r.tipo],
      hojaRuta: r.hojaRuta,
      ordenCarga: r.ordenCargaNumero,
      retiro: r.retiro?.numero ?? null,
      conductor: r.conductor,
      cliente: r.retiro?.cliente ?? null,
      patenteCamion: r.patenteCamion,
      tramo: r.tramo ?? `${r.origen} - ${r.destino}`,
      kmRecorridos: r.kmRecorridos,
      motorRemolque:
        r.remolqueConMotor === null ? '' : r.remolqueConMotor ? 'Con motor' : 'Sin motor',
      horasMotor: r.horasMotor,
      peajes: r.peajes,
      petroleo: r.petroleo,
      totalViaticos: r.totalViaticos,
      totalOtrosGastos: r.totalOtrosGastos,
      totalGeneral: r.totalGeneral,
    }),
    columnas: [
      { campo: 'numero', titulo: 'N°', tipo: 'correlativo', ancho: '6rem' },
      { campo: 'fecha', titulo: 'Fecha', tipo: 'fecha' },
      { campo: 'estado', titulo: 'Estado', tipo: 'estado' },
      { campo: 'tipo', titulo: 'Tipo', filtro: 'lista' },
      { campo: 'hojaRuta', titulo: 'Hoja de ruta', tipo: 'correlativo', oculta: true },
      { campo: 'ordenCarga', titulo: 'Orden carga', tipo: 'correlativo' },
      { campo: 'retiro', titulo: 'Orden retiro', tipo: 'correlativo', oculta: true },
      { campo: 'conductor', titulo: 'Conductor', filtro: 'lista' },
      { campo: 'cliente', titulo: 'Cliente', filtro: 'lista' },
      { campo: 'patenteCamion', titulo: 'Camión', filtro: 'lista' },
      { campo: 'tramo', titulo: 'Tramo', filtro: 'lista', oculta: true },
      { campo: 'kmRecorridos', titulo: 'Km', tipo: 'numero' },
      { campo: 'motorRemolque', titulo: 'Motor remolque', filtro: 'lista' },
      { campo: 'horasMotor', titulo: 'Horas motor', tipo: 'decimal', oculta: true },
      { campo: 'peajes', titulo: 'Peajes', tipo: 'pesos', oculta: true },
      { campo: 'petroleo', titulo: 'Petróleo', tipo: 'pesos', oculta: true },
      { campo: 'totalViaticos', titulo: 'Viáticos', tipo: 'pesos' },
      { campo: 'totalOtrosGastos', titulo: 'Otros gastos', tipo: 'pesos' },
      { campo: 'totalGeneral', titulo: 'Total', tipo: 'pesos' },
    ],
  };
}

@Component({
  selector: 'nt-lista-estadias',
  imports: [ListadoDocumentos],
  template: `<nt-listado-documentos [config]="config" />`,
})
export class ListaEstadias {
  readonly config: ConfigListado = {
    titulo: 'Estadías',
    descripcion:
      'Gastos del conductor mientras espera en un lugar, sin orden de carga. Son rendiciones (mismo correlativo) y llevan N° de hoja de ruta por su fecha de inicio.',
    recurso: 'rendiciones',
    parametros: { tipo: 'ESTADIA' },
    claveEstado: 'estadias',
    estados: ['EMITIDO', 'ANULADO'],
    todos: 'Todas',
    etiquetaNuevo: 'Nueva estadía',
    permisoNuevo: 'editarFinanzas',
    aplanar: (r: RendicionDto) => ({
      id: r.id,
      numero: r.numero,
      hojaRuta: r.hojaRuta,
      fecha: r.fecha,
      fechaSalida: r.fechaSalida,
      fechaLlegada: r.fechaLlegada,
      estado: r.estado,
      conductor: r.conductor,
      destino: r.destino,
      patenteCamion: r.patenteCamion,
      patenteRemolque: r.patenteRemolque,
      totalViaticos: r.totalViaticos,
      totalOtrosGastos: r.totalOtrosGastos,
      totalGeneral: r.totalGeneral,
    }),
    columnas: [
      { campo: 'numero', titulo: 'N°', tipo: 'correlativo', ancho: '6rem' },
      { campo: 'hojaRuta', titulo: 'Hoja de ruta', tipo: 'correlativo' },
      { campo: 'fecha', titulo: 'Fecha rendición', tipo: 'fecha' },
      { campo: 'fechaSalida', titulo: 'Inicio', tipo: 'fecha' },
      { campo: 'fechaLlegada', titulo: 'Término', tipo: 'fecha' },
      { campo: 'estado', titulo: 'Estado', tipo: 'estado' },
      { campo: 'conductor', titulo: 'Conductor', filtro: 'lista' },
      { campo: 'destino', titulo: 'Lugar', filtro: 'lista' },
      { campo: 'patenteCamion', titulo: 'Camión', filtro: 'lista' },
      { campo: 'patenteRemolque', titulo: 'Remolque', filtro: 'lista', oculta: true },
      { campo: 'totalViaticos', titulo: 'Viáticos', tipo: 'pesos' },
      { campo: 'totalOtrosGastos', titulo: 'Otros gastos', tipo: 'pesos' },
      { campo: 'totalGeneral', titulo: 'Total', tipo: 'pesos' },
    ],
  };
}

@Component({
  selector: 'nt-lista-hojas-ruta',
  imports: [ListadoDocumentos],
  template: `<nt-listado-documentos [config]="config" />`,
})
export class ListaHojasRuta {
  readonly config: ConfigListado = {
    titulo: 'Hojas de ruta',
    descripcion:
      'Una por flete con guías y una por estadía, numeradas por fecha de carga (o de inicio de la estadía). Si se ingresa una con fecha anterior, las siguientes se corren.',
    recurso: 'hojas-ruta',
    claveEstado: 'hojas-ruta',
    estados: ['ABIERTA', 'RENDIDA'],
    todos: 'Todas',
    aplanar: (h: HojaRutaDto) => ({
      ...h,
      tipo: TIPO_RENDICION_ETIQUETA[h.tipo],
    }),
    columnas: [
      { campo: 'numero', titulo: 'N° hoja', tipo: 'correlativo', ancho: '6rem' },
      { campo: 'fecha', titulo: 'Fecha', tipo: 'fecha' },
      { campo: 'estado', titulo: 'Estado', tipo: 'estado' },
      { campo: 'tipo', titulo: 'Tipo', filtro: 'lista' },
      { campo: 'origen', titulo: 'Origen', filtro: 'lista' },
      { campo: 'destino', titulo: 'Destino', filtro: 'lista' },
      { campo: 'conductor', titulo: 'Chofer', filtro: 'lista', ancho: '12rem' },
      { campo: 'patenteCamion', titulo: 'Patente', filtro: 'lista' },
      { campo: 'patenteRemolque', titulo: 'Remolque', filtro: 'lista', oculta: true },
      { campo: 'cliente', titulo: 'Cliente', filtro: 'lista', oculta: true },
      { campo: 'tramo', titulo: 'Tramo', filtro: 'lista', oculta: true },
      { campo: 'ordenCargaNumero', titulo: 'Orden carga', tipo: 'correlativo', oculta: true },
      { campo: 'rendicionNumero', titulo: 'Rendición', tipo: 'correlativo', oculta: true },
      { campo: 'totalGastos', titulo: 'Gastos total', tipo: 'pesos' },
      { campo: 'peajes', titulo: 'Peajes', tipo: 'pesos' },
      { campo: 'cargaDescarga', titulo: 'Carga y descarga', tipo: 'pesos' },
      { campo: 'viaticos', titulo: 'Viáticos', tipo: 'pesos' },
      { campo: 'varios', titulo: 'Varios', tipo: 'pesos' },
      { campo: 'petroleo', titulo: 'Petróleo', tipo: 'pesos' },
    ],
  };
}
