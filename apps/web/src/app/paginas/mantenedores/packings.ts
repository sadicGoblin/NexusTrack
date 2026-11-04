import { Component, inject } from '@angular/core';
import { formatearCodigo } from '@nexustrack/shared';
import { DatosMaestrosService } from '../../nucleo/datos-maestros.service';
import { Mantenedor, type ConfigMantenedor } from '../../compartido/mantenedor/mantenedor';

@Component({
  selector: 'nt-packings',
  imports: [Mantenedor],
  template: `<nt-mantenedor [config]="config" />`,
})
export class Packings {
  private readonly maestros = inject(DatosMaestrosService);

  readonly config: ConfigMantenedor = {
    titulo: 'Packings',
    descripcion: 'Plantas de carga de cada cliente.',
    singular: 'packing',
    recurso: 'packings',
    eliminable: true,
    permiso: 'editarMantenedores',
    claveEstado: 'packings',
    conjuntos: ['clientes'],
    invalidar: 'packings',
    porDefecto: () => ({ activo: true }),
    anchoDialogo: '44rem',
    columnas: [
      { campo: 'codigo', titulo: 'Código', ancho: '7rem' },
      { campo: 'cliente', titulo: 'Cliente', filtro: 'lista' },
      { campo: 'nombre', titulo: 'Packing' },
      { campo: 'ubicacion', titulo: 'Ubicación', ancho: '22rem' },
      { campo: 'activo', titulo: 'Activo', tipo: 'booleano' },
    ],
    campos: [
      {
        campo: 'codigo',
        etiqueta: 'Código',
        tipo: 'texto',
        mayusculas: true,
        max: 30,
        formatear: formatearCodigo,
        ayuda: 'Formato COX-005. Si lo deja vacío se asigna PK-001, PK-002…',
      },
      {
        campo: 'clienteId',
        etiqueta: 'Cliente',
        tipo: 'select',
        requerido: true,
        ancho: 2,
        opciones: () => this.maestros.opcionesClientes(),
      },
      { campo: 'activo', etiqueta: 'Activo', tipo: 'booleano' },
      {
        campo: 'nombre',
        etiqueta: 'Packing',
        tipo: 'texto',
        requerido: true,
        ancho: 4,
        mayusculas: true,
        max: 120,
      },
      {
        campo: 'ubicacion',
        etiqueta: 'Ubicación',
        tipo: 'texto',
        ancho: 4,
        mayusculas: true,
        max: 250,
      },
    ],
  };
}
