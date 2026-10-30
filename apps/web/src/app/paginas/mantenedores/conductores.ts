import { Component, inject } from '@angular/core';
import { DatosMaestrosService } from '../../nucleo/datos-maestros.service';
import { Mantenedor, type ConfigMantenedor } from '../../compartido/mantenedor/mantenedor';

@Component({
  selector: 'nt-conductores',
  imports: [Mantenedor],
  template: `<nt-mantenedor [config]="config" />`,
})
export class Conductores {
  private readonly maestros = inject(DatosMaestrosService);

  readonly config: ConfigMantenedor = {
    titulo: 'Conductores',
    descripcion: 'Conductores propios (trabajadores) y de empresas terceras.',
    singular: 'conductor',
    recurso: 'conductores',
    permiso: 'editarMantenedores',
    claveEstado: 'conductores',
    conjuntos: ['empresas'],
    invalidar: 'conductores',
    porDefecto: () => ({ activo: true, tipo: 'TRABAJADOR' }),
    columnas: [
      { campo: 'rut', titulo: 'RUT', ancho: '8rem' },
      { campo: 'nombre', titulo: 'Conductor', ancho: '16rem' },
      { campo: 'tipo', titulo: 'Tipo', filtro: 'lista' },
      { campo: 'empresa', titulo: 'Empresa', filtro: 'lista', ancho: '16rem' },
      { campo: 'comision', titulo: '% Comisión', tipo: 'porcentaje' },
      { campo: 'numeroLicencia', titulo: 'N° licencia', oculta: true },
      { campo: 'vencLicencia', titulo: 'Venc. licencia', tipo: 'fecha', alertaVencimiento: true },
      { campo: 'fechaIngreso', titulo: 'Fecha ingreso', tipo: 'fecha', oculta: true },
      { campo: 'terminoContrato', titulo: 'Término contrato', tipo: 'fecha', oculta: true },
      { campo: 'direccion', titulo: 'Dirección', oculta: true },
      { campo: 'telefono', titulo: 'Móvil' },
      { campo: 'numeroCuenta', titulo: 'N° cuenta', oculta: true },
      { campo: 'banco', titulo: 'Banco', oculta: true },
      { campo: 'activo', titulo: 'Activo', tipo: 'booleano' },
    ],
    campos: [
      {
        campo: 'nombre',
        etiqueta: 'Nombre',
        tipo: 'texto',
        requerido: true,
        ancho: 2,
        mayusculas: true,
        max: 150,
      },
      { campo: 'rut', etiqueta: 'RUT', tipo: 'rut', requerido: true },
      { campo: 'activo', etiqueta: 'Activo', tipo: 'booleano' },
      {
        campo: 'empresaId',
        etiqueta: 'Empresa',
        tipo: 'select',
        requerido: true,
        ancho: 2,
        opciones: () => this.maestros.opcionesEmpresas(),
      },
      {
        campo: 'tipo',
        etiqueta: 'Tipo',
        tipo: 'select',
        requerido: true,
        opciones: () => [
          { label: 'Trabajador', value: 'TRABAJADOR' },
          { label: 'Tercero', value: 'TERCERO' },
        ],
        ayuda: 'Se sugiere según la categoría de la empresa.',
      },
      { campo: 'comision', etiqueta: '% Comisión', tipo: 'porcentaje' },
      {
        campo: 'numeroLicencia',
        etiqueta: 'N° licencia',
        tipo: 'texto',
        mayusculas: true,
        max: 40,
      },
      { campo: 'vencLicencia', etiqueta: 'Vencimiento licencia', tipo: 'fecha' },
      { campo: 'fechaIngreso', etiqueta: 'Fecha ingreso', tipo: 'fecha' },
      { campo: 'terminoContrato', etiqueta: 'Término contrato', tipo: 'fecha' },
      {
        campo: 'direccion',
        etiqueta: 'Dirección',
        tipo: 'texto',
        ancho: 2,
        mayusculas: true,
        max: 250,
      },
      { campo: 'telefono', etiqueta: 'Móvil', tipo: 'telefono', max: 40 },
      { campo: 'banco', etiqueta: 'Banco', tipo: 'texto', mayusculas: true, max: 80 },
      { campo: 'numeroCuenta', etiqueta: 'N° cuenta', tipo: 'texto', ancho: 2, max: 40 },
    ],
    // Socio → trabajador propio; fletero o externo → tercero. Solo sugiere al cambiar la empresa.
    alCambiar: (form, _editando, campo) => {
      if (campo !== 'empresaId') return;
      const empresa = this.maestros.empresas().find((e) => e.id === form.get('empresaId')?.value);
      if (empresa)
        form.get('tipo')?.setValue(empresa.categoriaCodigo === 'SOCIO' ? 'TRABAJADOR' : 'TERCERO', {
          emitEvent: false,
        });
    },
  };
}
