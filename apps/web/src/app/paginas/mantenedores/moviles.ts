import { Component, inject } from '@angular/core';
import { DatosMaestrosService } from '../../nucleo/datos-maestros.service';
import { Mantenedor, type ConfigMantenedor } from '../../compartido/mantenedor/mantenedor';

@Component({
  selector: 'nt-moviles',
  imports: [Mantenedor],
  template: `<nt-mantenedor [config]="config" />`,
})
export class Moviles {
  private readonly maestros = inject(DatosMaestrosService);

  readonly config: ConfigMantenedor = {
    titulo: 'Móviles',
    descripcion:
      'Parque de camiones y remolques. Las fechas en rojo están vencidas y en ámbar vencen en 30 días o menos.',
    singular: 'móvil',
    recurso: 'moviles',
    permiso: 'editarMantenedores',
    claveEstado: 'moviles',
    conjuntos: ['catalogos', 'empresas'],
    invalidar: 'moviles',
    porDefecto: () => ({ activo: true }),
    columnas: [
      { campo: 'patente', titulo: 'Patente', ancho: '7rem' },
      { campo: 'tipo', titulo: 'Tipo', filtro: 'lista' },
      { campo: 'marca', titulo: 'Marca', filtro: 'lista' },
      { campo: 'modelo', titulo: 'Modelo' },
      { campo: 'anio', titulo: 'Año', filtro: 'numero' },
      { campo: 'color', titulo: 'Color', filtro: 'lista' },
      { campo: 'numeroMotor', titulo: 'N° motor', oculta: true },
      { campo: 'numeroChasis', titulo: 'N° chasis', oculta: true },
      { campo: 'empresa', titulo: 'Empresa', filtro: 'lista', ancho: '14rem' },
      { campo: 'tipoEmpresa', titulo: 'Tipo empresa', filtro: 'lista' },
      {
        campo: 'vencRevisionTecnica',
        titulo: 'Venc. revisión técnica',
        tipo: 'fecha',
        alertaVencimiento: true,
      },
      {
        campo: 'vencPermisoCirculacion',
        titulo: 'Venc. permiso circulación',
        tipo: 'fecha',
        alertaVencimiento: true,
      },
      { campo: 'vencSeguro', titulo: 'Venc. seguro', tipo: 'fecha', alertaVencimiento: true },
      { campo: 'activo', titulo: 'Activo', tipo: 'booleano' },
    ],
    campos: [
      {
        campo: 'patente',
        etiqueta: 'Patente',
        tipo: 'texto',
        requerido: true,
        mayusculas: true,
        max: 10,
      },
      {
        campo: 'tipoId',
        etiqueta: 'Tipo',
        tipo: 'select',
        requerido: true,
        opciones: (v) => this.maestros.opcionesCatalogo('TIPO_MOVIL', v['tipoId']),
      },
      { campo: 'marca', etiqueta: 'Marca', tipo: 'texto', mayusculas: true, max: 60 },
      { campo: 'modelo', etiqueta: 'Modelo', tipo: 'texto', mayusculas: true, max: 60 },
      { campo: 'anio', etiqueta: 'Año', tipo: 'entero', agrupar: false, min: 1950, max: 2100 },
      { campo: 'color', etiqueta: 'Color', tipo: 'texto', mayusculas: true, max: 30 },
      { campo: 'numeroMotor', etiqueta: 'N° motor', tipo: 'texto', mayusculas: true, max: 40 },
      {
        campo: 'numeroChasis',
        etiqueta: 'N° chasis',
        tipo: 'texto',
        mayusculas: true,
        max: 40,
        ayuda: 'Número de chasis (VIN) del padrón.',
      },
      {
        campo: 'empresaId',
        etiqueta: 'Empresa',
        tipo: 'select',
        requerido: true,
        ancho: 2,
        opciones: () => this.maestros.opcionesEmpresas(),
      },
      {
        campo: 'tipoEmpresa',
        etiqueta: 'Tipo empresa',
        tipo: 'calculado',
        calcular: (v) =>
          this.maestros.empresas().find((e) => e.id === v['empresaId'])?.categoria ?? '',
        ayuda: 'Se toma de la categoría de la empresa.',
      },
      { campo: 'vencRevisionTecnica', etiqueta: 'Vencimiento revisión técnica', tipo: 'fecha' },
      {
        campo: 'vencPermisoCirculacion',
        etiqueta: 'Vencimiento permiso de circulación',
        tipo: 'fecha',
      },
      { campo: 'vencSeguro', etiqueta: 'Vencimiento seguro', tipo: 'fecha' },
      { campo: 'activo', etiqueta: 'Activo', tipo: 'booleano' },
    ],
  };
}
