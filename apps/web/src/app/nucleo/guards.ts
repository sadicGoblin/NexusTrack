import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import type { Permiso } from '@nexustrack/shared';
import { SesionService } from './sesion.service';

/** Exige sesión; si no hay, intenta renovarla con la cookie antes de enviar al login. */
export const requiereSesion: CanActivateFn = async (_ruta, estado) => {
  const sesion = inject(SesionService);
  const router = inject(Router);
  if (sesion.autenticado() || (await sesion.renovar())) return true;
  return router.createUrlTree(['/login'], { queryParams: { volver: estado.url } });
};

export const requierePermiso =
  (permiso: Permiso): CanActivateFn =>
  () => {
    const sesion = inject(SesionService);
    return sesion.puede(permiso) || inject(Router).createUrlTree(['/inicio']);
  };

export const soloInvitado: CanActivateFn = async () => {
  const sesion = inject(SesionService);
  if (sesion.autenticado() || (await sesion.renovar()))
    return inject(Router).createUrlTree(['/inicio']);
  return true;
};
