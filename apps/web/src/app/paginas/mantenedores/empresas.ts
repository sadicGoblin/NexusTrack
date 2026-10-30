import { Component, inject } from '@angular/core';
import { DatosMaestrosService } from '../../nucleo/datos-maestros.service';
import { Mantenedor, type ConfigMantenedor } from '../../compartido/mantenedor/mantenedor';

@Component({
  selector: 'nt-empresas',
  imports: [Mantenedor],
  template: `<nt-mantenedor [config]="config" />`,
})
export class Empresas {
  private readonly maestros = inject(DatosMaestrosService);

  readonly config: ConfigMantenedor = {
    titulo: 'Empresas',
    descripcion: 'Empresas que realizan los fletes: socios, fleteros y externos.',
    singular: 'empresa',
    femenino: true,
    recurso: 'empresas',
    permiso: 'editarMantenedores',
    claveEstado: 'empresas',
    conjuntos: ['catalogos'],
    invalidar: 'empresas',
    porDefecto: () => ({ activo: true }),
    columnas: [
      { campo: 'rut', titulo: 'RUT', ancho: '9rem' },
      { campo: 'razonSocial', titulo: 'Empresa', ancho: '18rem' },
      { campo: 'categoria', titulo: 'Categoría', filtro: 'lista' },
      { campo: 'propietario', titulo: 'Propietario' },
      { campo: 'fono', titulo: 'Fono móvil' },
      { campo: 'email', titulo: 'Email' },
      { campo: 'activo', titulo: 'Activa', tipo: 'booleano' },
    ],
    campos: [
      {
        campo: 'razonSocial',
        etiqueta: 'Razón social',
        tipo: 'texto',
        requerido: true,
        ancho: 3,
        mayusculas: true,
        max: 150,
      },
      { campo: 'rut', etiqueta: 'RUT', tipo: 'rut', requerido: true },
      {
        campo: 'categoriaId',
        etiqueta: 'Categoría',
        tipo: 'select',
        requerido: true,
        opciones: (v) => this.maestros.opcionesCatalogo('CATEGORIA_EMPRESA', v['categoriaId']),
      },
      {
        campo: 'propietario',
        etiqueta: 'Propietario',
        tipo: 'texto',
        ancho: 2,
        mayusculas: true,
        max: 120,
      },
      { campo: 'activo', etiqueta: 'Activa', tipo: 'booleano' },
      { campo: 'fono', etiqueta: 'Fono', tipo: 'telefono', ancho: 2, max: 40 },
      { campo: 'email', etiqueta: 'Email', tipo: 'email', ancho: 2 },
    ],
  };
}
