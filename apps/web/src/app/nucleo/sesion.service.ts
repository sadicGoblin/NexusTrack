import { HttpClient, HttpContext, HttpContextToken } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './config';
import { tienePermiso, type Permiso, type SesionDto, type UsuarioSesion } from '@nexustrack/shared';

/** Marca solicitudes que no deben disparar la renovación de sesión ni el aviso de error. */
export const SIN_RENOVAR = new HttpContextToken<boolean>(() => false);

/**
 * Estado de la sesión. El access token vive solo en memoria; la renovación usa la cookie
 * httpOnly que entrega la API, por lo que recargar la página no obliga a ingresar de nuevo.
 */
@Injectable({ providedIn: 'root' })
export class SesionService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _usuario = signal<UsuarioSesion | null>(null);
  private token: string | null = null;
  private renovando: Promise<string | null> | null = null;

  readonly usuario = this._usuario.asReadonly();
  readonly autenticado = computed(() => this._usuario() !== null);

  get accessToken(): string | null {
    return this.token;
  }

  puede(permiso: Permiso): boolean {
    return tienePermiso(this._usuario()?.rol, permiso);
  }

  async iniciar(email: string, password: string): Promise<void> {
    const sesion = await firstValueFrom(
      this.http.post<SesionDto>(
        `${API_BASE}/auth/login`,
        { email, password },
        { context: new HttpContext().set(SIN_RENOVAR, true) },
      ),
    );
    this.aplicar(sesion);
  }

  /** Intenta recuperar la sesión con la cookie de renovación (al cargar la app o ante un 401). */
  renovar(): Promise<string | null> {
    this.renovando ??= firstValueFrom(
      this.http.post<SesionDto>(
        `${API_BASE}/auth/refresh`,
        {},
        { context: new HttpContext().set(SIN_RENOVAR, true) },
      ),
    )
      .then((s) => {
        this.aplicar(s);
        return s.accessToken;
      })
      .catch(() => {
        this.limpiar();
        return null;
      })
      .finally(() => (this.renovando = null));
    return this.renovando;
  }

  async cambiarPassword(actual: string, nueva: string): Promise<void> {
    const sesion = await firstValueFrom(
      this.http.post<SesionDto>(`${API_BASE}/auth/cambiar-password`, { actual, nueva }),
    );
    this.aplicar(sesion);
  }

  async cerrar(redirigir = true): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `${API_BASE}/auth/logout`,
        {},
        { context: new HttpContext().set(SIN_RENOVAR, true) },
      ),
    ).catch(() => undefined);
    this.limpiar();
    if (redirigir) await this.router.navigate(['/login']);
  }

  private aplicar(sesion: SesionDto): void {
    this.token = sesion.accessToken;
    this._usuario.set(sesion.usuario);
  }

  private limpiar(): void {
    this.token = null;
    this._usuario.set(null);
  }
}
