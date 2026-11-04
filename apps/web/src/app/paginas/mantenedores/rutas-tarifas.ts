import { Component, inject } from '@angular/core';
import { formatearCodigo, generarTramo } from '@nexustrack/shared';
import { DatosMaestrosService } from '../../nucleo/datos-maestros.service';
import { Mantenedor, type ConfigMantenedor } from '../../compartido/mantenedor/mantenedor';

@Component({
  selector: 'nt-rutas-tarifas',
  imports: [Mantenedor],
  template: `<nt-mantenedor [config]="config" />`,
})
export class RutasTarifas {
  private readonly maestros = inject(DatosMaestrosService);

  private valorCatalogo(id: unknown): string {
    return this.maestros.catalogos().find((c) => c.id === id)?.valor ?? '';
  }

  readonly config: ConfigMantenedor = {
    titulo: 'Rutas y tarifas',
    descripcion:
      'Tarifas por tramo y unidad para cada cliente. Se usan al valorizar las guías de las órdenes de carga.',
    singular: 'tarifa',
    femenino: true,
    recurso: 'rutas-tarifas',
    eliminable: true,
    permiso: 'editarTarifas',
    claveEstado: 'rutas-tarifas',
    conjuntos: ['catalogos', 'clientes'],
    porDefecto: () => ({ activo: true }),
    columnas: [
      { campo: 'codigo', titulo: 'Código', ancho: '7rem' },
      { campo: 'cliente', titulo: 'Cliente', filtro: 'lista' },
      { campo: 'origen', titulo: 'Origen', filtro: 'lista' },
      { campo: 'destino', titulo: 'Destino', filtro: 'lista' },
      { campo: 'unidad', titulo: 'Unidad', filtro: 'lista' },
      { campo: 'tramo', titulo: 'Tramo', ancho: '18rem' },
      { campo: 'distanciaKm', titulo: 'Distancia (km)', tipo: 'decimal' },
      { campo: 'valor', titulo: 'Valor', tipo: 'pesos' },
      { campo: 'vigenciaDesde', titulo: 'Vigencia desde', tipo: 'fecha', oculta: true },
      { campo: 'vigenciaHasta', titulo: 'Vigencia hasta', tipo: 'fecha', alertaVencimiento: true },
      { campo: 'vigente', titulo: 'Vigente', tipo: 'booleano' },
      { campo: 'activo', titulo: 'Activa', tipo: 'booleano', oculta: true },
    ],
    campos: [
      {
        campo: 'codigo',
        etiqueta: 'Código ruta',
        tipo: 'texto',
        mayusculas: true,
        max: 30,
        formatear: formatearCodigo,
        ayuda: 'Formato COX-005. Si lo deja vacío se asigna RT-001, RT-002…',
      },
      {
        campo: 'clienteId',
        etiqueta: 'Cliente',
        tipo: 'select',
        requerido: true,
        ancho: 2,
        opciones: () => this.maestros.opcionesClientes(),
      },
      { campo: 'activo', etiqueta: 'Activa', tipo: 'booleano' },
      {
        campo: 'origenId',
        etiqueta: 'Origen',
        tipo: 'select',
        requerido: true,
        opciones: (v) => this.maestros.opcionesCatalogo('CIUDAD', v['origenId']),
      },
      {
        campo: 'destinoId',
        etiqueta: 'Destino',
        tipo: 'select',
        requerido: true,
        opciones: (v) => this.maestros.opcionesCatalogo('CIUDAD', v['destinoId']),
      },
      {
        campo: 'unidadId',
        etiqueta: 'Unidad',
        tipo: 'select',
        requerido: true,
        ancho: 2,
        opciones: (v) => this.maestros.opcionesCatalogo('UNIDAD_RUTA', v['unidadId']),
      },
      {
        campo: 'tramo',
        etiqueta: 'Tramo',
        tipo: 'calculado',
        ancho: 4,
        ayuda: 'Se genera solo a partir del origen, destino y unidad.',
        calcular: (v) =>
          v['origenId'] && v['destinoId'] && v['unidadId']
            ? generarTramo(
                this.valorCatalogo(v['origenId']),
                this.valorCatalogo(v['destinoId']),
                this.valorCatalogo(v['unidadId']),
              )
            : '',
      },
      { campo: 'distanciaKm', etiqueta: 'Distancia (km)', tipo: 'decimal', decimales: 1, min: 0 },
      { campo: 'valor', etiqueta: 'Valor', tipo: 'pesos', requerido: true, min: 1 },
      { campo: 'vigenciaDesde', etiqueta: 'Vigencia desde', tipo: 'fecha' },
      { campo: 'vigenciaHasta', etiqueta: 'Vigencia hasta', tipo: 'fecha' },
    ],
  };
}
