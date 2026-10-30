import type { Routes } from '@angular/router';
import { requierePermiso, requiereSesion, soloInvitado } from './nucleo/guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [soloInvitado],
    title: 'Ingresar · NexusTrack',
    loadComponent: () => import('./paginas/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [requiereSesion],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        title: 'Inicio · NexusTrack',
        loadComponent: () => import('./paginas/inicio/inicio').then((m) => m.Inicio),
      },
      {
        path: 'operacion',
        loadChildren: () =>
          import('./paginas/documentos/documentos.routes').then((m) => m.rutasDocumentos),
      },
      {
        path: 'mantenedores',
        loadChildren: () =>
          import('./paginas/mantenedores/mantenedores.routes').then((m) => m.rutasMantenedores),
      },
      {
        path: 'administracion',
        canActivate: [requierePermiso('administrar')],
        loadChildren: () =>
          import('./paginas/administracion/administracion.routes').then(
            (m) => m.rutasAdministracion,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'inicio' },
];
