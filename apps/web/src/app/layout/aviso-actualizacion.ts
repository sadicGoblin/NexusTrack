import { Component, computed, inject } from '@angular/core';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { ActualizacionService } from '../nucleo/actualizacion.service';

/** Aviso de versión nueva: bloquea la pantalla hasta actualizar, salvo el plazo para guardar. */
@Component({
  selector: 'nt-aviso-actualizacion',
  imports: [Dialog, Button],
  template: `
    @if (servicio.estado() === 'plazo') {
      <div class="franja" role="status">
        <i class="pi pi-refresh" aria-hidden="true"></i>
        <span
          >Hay una versión nueva de NexusTrack. Guarde sus cambios y actualice
          <strong>(quedan {{ restante() }})</strong>.</span
        >
        <p-button
          label="Actualizar ahora"
          size="small"
          severity="contrast"
          (onClick)="servicio.actualizar()"
        />
      </div>
    }
    <p-dialog
      header="Hay una versión nueva"
      [visible]="servicio.estado() === 'aviso'"
      [modal]="true"
      [closable]="false"
      [closeOnEscape]="false"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '30rem' }"
      [breakpoints]="{ '640px': '92vw' }"
    >
      @if (!servicio.conCambios()) {
        <p>
          Se publicó una actualización de NexusTrack. Para continuar, actualice la página; toma unos
          segundos.
        </p>
      } @else if (servicio.puedePostergar()) {
        <p>
          Se publicó una actualización de NexusTrack y tiene <strong>cambios sin guardar</strong>.
          Guárdelos y luego actualice; tiene {{ servicio.minutosDePlazo }} minutos.
        </p>
      } @else {
        <p>
          Se acabó el plazo para guardar. Actualice para continuar; los cambios que no guardó se
          perderán.
        </p>
      }
      <ng-template #footer>
        @if (servicio.conCambios() && servicio.puedePostergar()) {
          <p-button
            label="Actualizar sin guardar"
            severity="danger"
            [text]="true"
            (onClick)="servicio.actualizar()"
          />
          <p-button label="Guardar primero" icon="pi pi-save" (onClick)="servicio.postergar()" />
        } @else {
          <p-button
            label="Actualizar ahora"
            icon="pi pi-refresh"
            (onClick)="servicio.actualizar()"
          />
        }
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .franja {
      position: fixed;
      left: 50%;
      bottom: 1rem;
      transform: translateX(-50%);
      z-index: 3000;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: max-content;
      max-width: calc(100vw - 2rem);
      padding: 0.6rem 0.75rem 0.6rem 1rem;
      border-radius: 10px;
      background: #fbbf24;
      color: #1c1917;
      font-size: 0.88rem;
      box-shadow: 0 6px 24px rgb(0 0 0 / 0.18);
    }

    p {
      margin: 0;
      line-height: 1.5;
    }
  `,
})
export class AvisoActualizacion {
  protected readonly servicio = inject(ActualizacionService);

  protected readonly restante = computed(() => {
    const segundos = Math.max(
      0,
      Math.ceil((this.servicio.plazoHasta() - this.servicio.ahora()) / 1000),
    );
    return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
  });
}
