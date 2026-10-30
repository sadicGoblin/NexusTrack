import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import {
  tienePermiso,
  type Permiso,
  type UsuarioSesion,
} from '@nexustrack/shared';
import { CLAVE_PERMISO, CLAVE_PUBLICO } from './decoradores.js';

/** Exige un access token válido salvo en endpoints marcados con @Publico(). */
@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(ctx: ExecutionContext) {
    const publico = this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    return publico ? true : super.canActivate(ctx);
  }

  override handleRequest<T>(err: unknown, user: T): T {
    if (err || !user) {
      throw new UnauthorizedException('Sesión expirada o inválida.');
    }
    return user;
  }
}

/** Aplica la matriz de permisos por rol. Sin @RequierePermiso basta con estar autenticado. */
@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const permiso = this.reflector.getAllAndOverride<Permiso | undefined>(
      CLAVE_PERMISO,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!permiso) return true;
    const usuario: UsuarioSesion | undefined = ctx
      .switchToHttp()
      .getRequest().user;
    if (!usuario) return true; // endpoint público
    if (!tienePermiso(usuario.rol, permiso)) {
      throw new ForbiddenException(
        'Su perfil no tiene permiso para esta acción.',
      );
    }
    return true;
  }
}
