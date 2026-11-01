import { Component } from '@angular/core';
import { Mantenedor, type ConfigMantenedor } from '../../compartido/mantenedor/mantenedor';

@Component({
  selector: 'nt-clientes',
  imports: [Mantenedor],
  template: `<nt-mantenedor [config]="config" />`,
})
export class Clientes {
  readonly config: ConfigMantenedor = {
    titulo: 'Clientes',
    descripcion: 'Clientes que solicitan los fletes.',
    singular: 'cliente',
    recurso: 'clientes',
    eliminable: true,
    permiso: 'editarMantenedores',
    claveEstado: 'clientes',
    invalidar: 'clientes',
    porDefecto: () => ({ activo: true }),
    columnas: [
      { campo: 'nombre', titulo: 'Cliente', ancho: '14rem' },
      { campo: 'rut', titulo: 'RUT', ancho: '9rem' },
      { campo: 'giro', titulo: 'Giro' },
      { campo: 'direccion', titulo: 'Dirección', ancho: '18rem' },
      { campo: 'contactoOperaciones', titulo: 'Contacto operaciones' },
      { campo: 'contactoAdministrativo', titulo: 'Contacto administrativo', oculta: true },
      { campo: 'fono', titulo: 'Fono' },
      { campo: 'email', titulo: 'Email', oculta: true },
      { campo: 'activo', titulo: 'Activo', tipo: 'booleano' },
    ],
    campos: [
      {
        campo: 'nombre',
        etiqueta: 'Cliente',
        tipo: 'texto',
        requerido: true,
        ancho: 2,
        mayusculas: true,
        max: 150,
      },
      { campo: 'rut', etiqueta: 'RUT', tipo: 'rut', requerido: true },
      { campo: 'activo', etiqueta: 'Activo', tipo: 'booleano' },
      { campo: 'giro', etiqueta: 'Giro', tipo: 'texto', ancho: 2, mayusculas: true, max: 150 },
      {
        campo: 'direccion',
        etiqueta: 'Dirección',
        tipo: 'texto',
        ancho: 2,
        mayusculas: true,
        max: 250,
      },
      {
        campo: 'contactoOperaciones',
        etiqueta: 'Contacto operaciones',
        tipo: 'texto',
        ancho: 2,
        max: 150,
      },
      {
        campo: 'contactoAdministrativo',
        etiqueta: 'Contacto administrativo',
        tipo: 'texto',
        ancho: 2,
        max: 150,
      },
      { campo: 'fono', etiqueta: 'Fono', tipo: 'telefono', ancho: 2, max: 40 },
      { campo: 'email', etiqueta: 'Email', tipo: 'email', ancho: 2 },
    ],
  };
}
