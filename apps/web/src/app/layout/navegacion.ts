import type { Permiso } from '@nexustrack/shared';

export interface ItemMenu {
  etiqueta: string;
  icono: string;
  ruta: string;
  permiso?: Permiso;
}

export interface GrupoMenu {
  titulo: string;
  items: ItemMenu[];
}

export const MENU: GrupoMenu[] = [
  { titulo: '', items: [{ etiqueta: 'Inicio', icono: 'pi pi-home', ruta: '/inicio' }] },
  {
    titulo: 'Operación',
    items: [
      {
        etiqueta: 'Órdenes de retiro',
        icono: 'pi pi-file-export',
        ruta: '/operacion/ordenes-retiro',
      },
      { etiqueta: 'Órdenes de carga', icono: 'pi pi-box', ruta: '/operacion/ordenes-carga' },
      { etiqueta: 'Vales de dinero', icono: 'pi pi-wallet', ruta: '/operacion/vales-dinero' },
      {
        etiqueta: 'Vales de combustible',
        icono: 'pi pi-gauge',
        ruta: '/operacion/vales-combustible',
      },
      { etiqueta: 'Rendiciones', icono: 'pi pi-receipt', ruta: '/operacion/rendiciones' },
      {
        etiqueta: 'Cuentas de conductores',
        icono: 'pi pi-book',
        ruta: '/operacion/cuentas-conductores',
      },
    ],
  },
  {
    titulo: 'Mantenedores',
    items: [
      { etiqueta: 'Asignaciones', icono: 'pi pi-link', ruta: '/mantenedores/asignaciones' },
      { etiqueta: 'Móviles', icono: 'pi pi-truck', ruta: '/mantenedores/moviles' },
      { etiqueta: 'Conductores', icono: 'pi pi-id-card', ruta: '/mantenedores/conductores' },
      { etiqueta: 'Empresas', icono: 'pi pi-building', ruta: '/mantenedores/empresas' },
      { etiqueta: 'Clientes', icono: 'pi pi-briefcase', ruta: '/mantenedores/clientes' },
      { etiqueta: 'Packings', icono: 'pi pi-warehouse', ruta: '/mantenedores/packings' },
      { etiqueta: 'Rutas y tarifas', icono: 'pi pi-map', ruta: '/mantenedores/rutas-tarifas' },
    ],
  },
  {
    titulo: 'Administración',
    items: [
      {
        etiqueta: 'Catálogos',
        icono: 'pi pi-list',
        ruta: '/administracion/catalogos',
        permiso: 'administrar',
      },
      {
        etiqueta: 'Usuarios',
        icono: 'pi pi-users',
        ruta: '/administracion/usuarios',
        permiso: 'administrar',
      },
      {
        etiqueta: 'Parámetros',
        icono: 'pi pi-sliders-h',
        ruta: '/administracion/parametros',
        permiso: 'administrar',
      },
      {
        etiqueta: 'Auditoría',
        icono: 'pi pi-history',
        ruta: '/administracion/auditoria',
        permiso: 'administrar',
      },
    ],
  },
];
