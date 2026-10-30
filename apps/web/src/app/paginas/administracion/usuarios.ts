import { Component } from '@angular/core';
import { Rol, ROL_ETIQUETA } from '@nexustrack/shared';
import { Mantenedor, type ConfigMantenedor } from '../../compartido/mantenedor/mantenedor';

@Component({
  selector: 'nt-usuarios',
  imports: [Mantenedor],
  template: `<nt-mantenedor [config]="config" />`,
})
export class Usuarios {
  readonly config: ConfigMantenedor = {
    titulo: 'Usuarios',
    descripcion:
      'Cuentas de acceso y su perfil. Administrador: todo. Operaciones: mantenedores, órdenes y vales. Finanzas: tarifas, vales y rendiciones. Solo lectura: consulta.',
    singular: 'usuario',
    recurso: 'usuarios',
    permiso: 'administrar',
    claveEstado: 'usuarios',
    porDefecto: () => ({ activo: true, rol: 'OPERACIONES' }),
    anchoDialogo: '40rem',
    columnas: [
      { campo: 'nombre', titulo: 'Nombre' },
      { campo: 'email', titulo: 'Correo' },
      { campo: 'rol', titulo: 'Perfil', filtro: 'lista' },
      { campo: 'activo', titulo: 'Activo', tipo: 'booleano' },
      { campo: 'ultimoAcceso', titulo: 'Último acceso', tipo: 'fecha' },
    ],
    campos: [
      { campo: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, ancho: 2, max: 120 },
      { campo: 'email', etiqueta: 'Correo', tipo: 'email', requerido: true, ancho: 2 },
      {
        campo: 'rol',
        etiqueta: 'Perfil',
        tipo: 'select',
        requerido: true,
        ancho: 2,
        opciones: () => Object.values(Rol).map((r) => ({ label: ROL_ETIQUETA[r], value: r })),
      },
      { campo: 'activo', etiqueta: 'Activo', tipo: 'booleano' },
      {
        campo: 'password',
        etiqueta: 'Contraseña',
        tipo: 'password',
        requeridoAlCrear: true,
        ancho: 4,
        ayuda:
          'Mínimo 8 caracteres con letras y números. Al editar, déjela vacía para mantener la actual.',
      },
    ],
  };
}
