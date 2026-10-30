import { HttpErrorResponse, type HttpInterceptorFn, type HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { API_BASE } from './config';
import { SesionService, SIN_RENOVAR } from './sesion.service';

/** Agrega el token y envía la cookie de renovación también cuando la API está en otro origen. */
const conToken = (req: HttpRequest<unknown>, token: string | null) =>
  req.clone({
    withCredentials: true,
    ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {}),
  });

/** Agrega el access token y, ante un 401, renueva la sesión una vez y reintenta. */
export const interceptorSesion: HttpInterceptorFn = (req, next) => {
  const sesion = inject(SesionService);
  const router = inject(Router);
  if (!req.url.startsWith(API_BASE)) return next(req);
  return next(conToken(req, sesion.accessToken)).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        req.context.get(SIN_RENOVAR)
      ) {
        return throwError(() => error);
      }
      return from(sesion.renovar()).pipe(
        switchMap((token) => {
          if (!token) {
            void router.navigate(['/login'], { queryParams: { volver: router.url } });
            return throwError(() => error);
          }
          return next(conToken(req, token));
        }),
      );
    }),
  );
};

/** Muestra los errores de la API como avisos con el mensaje en español que entrega el servidor. */
export const interceptorErrores: HttpInterceptorFn = (req, next) => {
  const mensajes = inject(MessageService);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        !req.context.get(SIN_RENOVAR) &&
        error.status !== 401
      ) {
        void avisar(mensajes, error);
      }
      return throwError(() => error);
    }),
  );
};

async function avisar(mensajes: MessageService, error: HttpErrorResponse): Promise<void> {
  let cuerpo = error.error;
  if (cuerpo instanceof Blob) cuerpo = JSON.parse(await cuerpo.text().catch(() => '{}'));
  const titulos: Record<number, string> = {
    0: 'Sin conexión',
    400: 'Revise los datos',
    403: 'Sin permiso',
    404: 'No encontrado',
    409: 'No se puede completar',
    429: 'Demasiados intentos',
  };
  const errores: string[] = Array.isArray(cuerpo?.errores) ? cuerpo.errores : [];
  const detalle =
    error.status === 0
      ? 'No se pudo conectar con el servidor. Verifique su conexión.'
      : errores.length > 1
        ? errores.join(' · ')
        : (cuerpo?.message ?? 'Ocurrió un error inesperado. Intente nuevamente.');
  mensajes.add({
    severity: error.status >= 500 || error.status === 0 ? 'error' : 'warn',
    summary: titulos[error.status] ?? 'Error del servidor',
    detail: Array.isArray(detalle) ? detalle.join(' · ') : detalle,
    life: 6000,
  });
}
