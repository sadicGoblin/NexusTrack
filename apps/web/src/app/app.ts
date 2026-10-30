import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Toast } from 'primeng/toast';
import { AvisoActualizacion } from './layout/aviso-actualizacion';
import { ActualizacionService } from './nucleo/actualizacion.service';

@Component({
  selector: 'nt-root',
  imports: [RouterOutlet, Toast, ConfirmDialog, AvisoActualizacion],
  template: `
    <p-toast position="top-right" />
    <p-confirmdialog [style]="{ width: '30rem' }" />
    <router-outlet />
    <nt-aviso-actualizacion />
  `,
})
export class App {
  constructor() {
    inject(ActualizacionService).iniciar();
  }
}
