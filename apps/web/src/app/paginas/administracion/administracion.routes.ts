import type { Routes } from '@angular/router';

export const rutasAdministracion: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'catalogos' },
  {
    path: 'catalogos',
    title: 'Catálogos · NexusTrack',
    loadComponent: () => import('./catalogos').then((m) => m.Catalogos),
  },
  {
    path: 'usuarios',
    title: 'Usuarios · NexusTrack',
    loadComponent: () => import('./usuarios').then((m) => m.Usuarios),
  },
  {
    path: 'parametros',
    title: 'Parámetros · NexusTrack',
    loadComponent: () => import('./parametros').then((m) => m.Parametros),
  },
  {
    path: 'auditoria',
    title: 'Auditoría · NexusTrack',
    loadComponent: () => import('./auditoria').then((m) => m.Auditoria),
  },
];
