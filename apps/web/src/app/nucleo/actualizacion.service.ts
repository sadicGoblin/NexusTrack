import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, NavigationError, Router } from '@angular/router';

declare const NT_VERSION: string | undefined;
/** Versión de esta compilación; la define el script de despliegue. Vacía en desarrollo. */
export const VERSION_WEB = typeof NT_VERSION !== 'undefined' ? NT_VERSION : '';

const CADA_REVISION = 5 * 60_000;
const MINIMO_ENTRE_REVISIONES = 30_000;
const PLAZO_PARA_GUARDAR = 10 * 60_000;
const CLAVE_RECARGA = 'nt-recarga-version';

/** Formularios con cambios sin guardar en pantalla (un formulario recién guardado vuelve a estar limpio). */
const CAMBIOS_SIN_GUARDAR = [
  '.nt-grilla.ng-dirty', // formularios de mantenedores y documentos
  '.tabla-lineas .ng-dirty', // líneas de documentos: guías, viáticos, gastos
  '.p-dialog .ng-dirty:not(nt-tabla *)', // diálogos de edición
  '.nt-sin-guardar', // marca explícita de las pantallas que editan de otra forma
].join(', ');

export function hayCambiosSinGuardar(): boolean {
  return !!document.querySelector(CAMBIOS_SIN_GUARDAR);
}

/** Al abrir una pantalla, su código ya no existe porque se publicó otra versión. */
function esFallaDeCarga(error: unknown): boolean {
  const mensaje = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(
    mensaje,
  );
}

type Estado = 'al-dia' | 'aviso' | 'plazo';

/**
 * Avisa cuando se publica una versión nueva de la web y exige actualizar para continuar.
 * Si hay cambios sin guardar, da un plazo para guardarlos; al guardarlos, o al vencer el plazo,
 * el aviso vuelve a bloquear la pantalla.
 */
@Injectable({ providedIn: 'root' })
export class ActualizacionService {
  private readonly router = inject(Router);

  readonly estado = signal<Estado>('al-dia');
  readonly conCambios = signal(false);
  readonly puedePostergar = signal(true);
  readonly plazoHasta = signal(0);
  readonly ahora = signal(Date.now());
  readonly minutosDePlazo = PLAZO_PARA_GUARDAR / 60_000;

  private versionNueva: string | null = null;
  private ultimaRevision = 0;
  private iniciado = false;

  iniciar(): void {
    if (this.iniciado) return;
    this.iniciado = true;
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationError && esFallaDeCarga(e.error)) this.mostrarAviso(null);
      if (e instanceof NavigationEnd) void this.revisar();
    });
    if (!VERSION_WEB) return;
    setInterval(() => void this.revisar(), CADA_REVISION);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.revisar(true);
    });
  }

  async revisar(forzar = false): Promise<void> {
    if (!VERSION_WEB || this.estado() !== 'al-dia') return;
    const ahora = Date.now();
    if (!forzar && ahora - this.ultimaRevision < MINIMO_ENTRE_REVISIONES) return;
    this.ultimaRevision = ahora;
    try {
      const respuesta = await fetch(`/version.json?t=${ahora}`, { cache: 'no-store' });
      if (!respuesta.ok) return;
      const { version } = (await respuesta.json()) as { version?: string };
      if (version && version !== VERSION_WEB) this.mostrarAviso(version);
    } catch {
      /* sin conexión: se vuelve a intentar en la próxima revisión */
    }
  }

  /** Deja guardar los cambios pendientes; el aviso vuelve al guardarlos o al vencer el plazo. */
  postergar(): void {
    this.puedePostergar.set(false);
    this.plazoHasta.set(Date.now() + PLAZO_PARA_GUARDAR);
    this.estado.set('plazo');
    const vigilancia = setInterval(() => {
      this.ahora.set(Date.now());
      const pendientes = hayCambiosSinGuardar();
      if (!pendientes || this.ahora() >= this.plazoHasta()) {
        clearInterval(vigilancia);
        this.conCambios.set(pendientes);
        this.estado.set('aviso');
      }
    }, 1000);
  }

  actualizar(): void {
    try {
      if (this.versionNueva) sessionStorage.setItem(CLAVE_RECARGA, this.versionNueva);
    } catch {
      /* almacenamiento no disponible */
    }
    location.reload();
  }

  private mostrarAviso(version: string | null): void {
    if (this.estado() !== 'al-dia') return;
    // Si ya se recargó por esta versión y sigue llegando la anterior (un caché intermedio),
    // insistir solo dejaría a la persona en un ciclo de recargas.
    try {
      if (version && sessionStorage.getItem(CLAVE_RECARGA) === version) return;
    } catch {
      /* almacenamiento no disponible */
    }
    this.versionNueva = version;
    this.conCambios.set(hayCambiosSinGuardar());
    this.estado.set('aviso');
  }
}
