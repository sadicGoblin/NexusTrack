import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { MessageService, type MenuItem } from 'primeng/api';
import { Avatar } from 'primeng/avatar';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Drawer } from 'primeng/drawer';
import { Menu } from 'primeng/menu';
import { Password } from 'primeng/password';
import { Tooltip } from 'primeng/tooltip';
import { ROL_ETIQUETA } from '@nexustrack/shared';
import { COMMIT_APP, fechaPublicacion, VERSION_APP } from '../nucleo/actualizacion.service';
import { guardarPreferencia, leerPreferencia } from '../nucleo/preferencias';
import { SesionService } from '../nucleo/sesion.service';
import { MENU } from './navegacion';

const CLAVE_TEMA = 'nt-tema';
const CLAVE_MENU = 'nt-menu-compacto';
/** Desde este ancho hacia abajo el menú no es lateral sino un panel que se abre encima. */
const PANTALLA_ANGOSTA = '(max-width: 1024px)';

@Component({
  selector: 'nt-shell',
  imports: [
    NgTemplateOutlet,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FormsModule,
    Button,
    Drawer,
    Menu,
    Avatar,
    Dialog,
    Password,
    Tooltip,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);
  private readonly mensajes = inject(MessageService);

  readonly usuario = this.sesion.usuario;
  readonly rol = computed(() => (this.usuario() ? ROL_ETIQUETA[this.usuario()!.rol] : ''));
  readonly iniciales = computed(() =>
    (this.usuario()?.nombre ?? '?')
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase(),
  );
  readonly menu = computed(() =>
    MENU.map((g) => ({
      ...g,
      items: g.items.filter((i) => !i.permiso || this.sesion.puede(i.permiso)),
    })).filter((g) => g.items.length),
  );
  readonly menuVisible = signal(false);
  /** Menú lateral reducido a íconos, con el nombre en un tooltip. */
  readonly menuCompacto = signal(leerPreferencia(CLAVE_MENU) === 'si');
  private readonly consultaAngosta = window.matchMedia?.(PANTALLA_ANGOSTA);
  readonly pantallaAngosta = signal(this.consultaAngosta?.matches ?? false);
  /** Versión publicada, al pie del menú, para saber qué tiene cada usuario. */
  readonly version = VERSION_APP ? `v${VERSION_APP}` : 'desarrollo';
  readonly commit = COMMIT_APP;
  readonly detalleVersion = VERSION_APP
    ? `Versión ${VERSION_APP} · commit ${COMMIT_APP} · publicada el ${fechaPublicacion()}`
    : 'Versión de desarrollo';

  readonly etiquetaMenu = computed(() =>
    this.pantallaAngosta() ? 'Abrir menú' : this.menuCompacto() ? 'Expandir menú' : 'Contraer menú',
  );
  readonly oscuro = signal(leerTema());

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  readonly seccion = computed(() => {
    const url = this.url();
    for (const g of MENU)
      for (const i of g.items)
        if (url.startsWith(i.ruta)) return { grupo: g.titulo, item: i.etiqueta };
    return { grupo: '', item: '' };
  });

  readonly menuUsuario: MenuItem[] = [
    {
      label: 'Cambiar contraseña',
      icon: 'pi pi-key',
      command: () => this.dialogoPassword.set(true),
    },
    { separator: true },
    { label: 'Cerrar sesión', icon: 'pi pi-sign-out', command: () => void this.sesion.cerrar() },
  ];

  readonly dialogoPassword = signal(false);
  readonly guardandoPassword = signal(false);
  passwordActual = '';
  passwordNueva = '';
  passwordConfirmacion = '';

  constructor() {
    aplicarTema(this.oscuro());
    const alCambiar = (e: MediaQueryListEvent) => this.pantallaAngosta.set(e.matches);
    this.consultaAngosta?.addEventListener('change', alCambiar);
    inject(DestroyRef).onDestroy(() =>
      this.consultaAngosta?.removeEventListener('change', alCambiar),
    );
  }

  alternarTema(): void {
    this.oscuro.update((v) => !v);
    aplicarTema(this.oscuro());
    guardarPreferencia(CLAVE_TEMA, this.oscuro() ? 'oscuro' : 'claro');
  }

  /** En pantallas angostas abre el panel; en las anchas reduce o expande el menú lateral. */
  alternarMenu(): void {
    if (this.pantallaAngosta()) {
      this.menuVisible.set(true);
      return;
    }
    this.menuCompacto.update((v) => !v);
    guardarPreferencia(CLAVE_MENU, this.menuCompacto() ? 'si' : 'no');
  }

  async cambiarPassword(): Promise<void> {
    if (this.passwordNueva !== this.passwordConfirmacion) {
      this.mensajes.add({
        severity: 'warn',
        summary: 'Revise los datos',
        detail: 'La confirmación no coincide con la nueva contraseña.',
      });
      return;
    }
    this.guardandoPassword.set(true);
    try {
      await this.sesion.cambiarPassword(this.passwordActual, this.passwordNueva);
      this.mensajes.add({
        severity: 'success',
        summary: 'Contraseña actualizada',
        detail: 'Las otras sesiones abiertas se cerraron.',
      });
      this.dialogoPassword.set(false);
      this.passwordActual = this.passwordNueva = this.passwordConfirmacion = '';
    } finally {
      this.guardandoPassword.set(false);
    }
  }
}

function leerTema(): boolean {
  const guardado = leerPreferencia(CLAVE_TEMA);
  if (guardado) return guardado === 'oscuro';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function aplicarTema(oscuro: boolean): void {
  document.documentElement.classList.toggle('nt-oscuro', oscuro);
}
