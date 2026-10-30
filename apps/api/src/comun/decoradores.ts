import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';
import type { Permiso, UsuarioSesion } from '@nexustrack/shared';

export const CLAVE_PUBLICO = 'publico';
export const CLAVE_PERMISO = 'permiso';

/** Endpoint accesible sin sesión. */
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);

/** Permiso requerido (ver PERMISOS en @nexustrack/shared). El del método reemplaza al de la clase. */
export const RequierePermiso = (permiso: Permiso) =>
  SetMetadata(CLAVE_PERMISO, permiso);

/** Usuario autenticado de la solicitud. */
export const UsuarioActual = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UsuarioSesion =>
    ctx.switchToHttp().getRequest().user,
);
