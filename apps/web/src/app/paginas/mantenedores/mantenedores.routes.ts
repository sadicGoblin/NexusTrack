import type { Routes } from '@angular/router';

export const rutasMantenedores: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'asignaciones' },
  {
    path: 'empresas',
    title: 'Empresas · NexusTrack',
    loadComponent: () => import('./empresas').then((m) => m.Empresas),
  },
  {
    path: 'clientes',
    title: 'Clientes · NexusTrack',
    loadComponent: () => import('./clientes').then((m) => m.Clientes),
  },
  {
    path: 'packings',
    title: 'Packings · NexusTrack',
    loadComponent: () => import('./packings').then((m) => m.Packings),
  },
  {
    path: 'moviles',
    title: 'Móviles · NexusTrack',
    loadComponent: () => import('./moviles').then((m) => m.Moviles),
  },
  {
    path: 'conductores',
    title: 'Conductores · NexusTrack',
    loadComponent: () => import('./conductores').then((m) => m.Conductores),
  },
  {
    path: 'rutas-tarifas',
    title: 'Rutas y tarifas · NexusTrack',
    loadComponent: () => import('./rutas-tarifas').then((m) => m.RutasTarifas),
  },
  {
    path: 'asignaciones',
    title: 'Asignaciones · NexusTrack',
    loadComponent: () => import('./asignaciones/asignaciones').then((m) => m.Asignaciones),
  },
];
