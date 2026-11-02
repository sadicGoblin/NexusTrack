import type { Routes } from '@angular/router';

export const rutasInformes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'control-fletes' },
  {
    path: 'control-fletes',
    title: 'Control de fletes · NexusTrack',
    loadComponent: () => import('./control-fletes').then((m) => m.ControlFletes),
  },
  {
    path: 'facturacion',
    title: 'Órdenes por facturar · NexusTrack',
    loadComponent: () => import('./facturacion').then((m) => m.Facturacion),
  },
];
