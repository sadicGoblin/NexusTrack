import { Component, computed, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { SelectButton } from 'primeng/selectbutton';
import { desplazar, MapaRecorrido, type ConsultaRecorrido } from '../gps/mapa-recorrido';

/**
 * Trazabilidad del camión entre la salida y la llegada de la rendición (solo historial), en un
 * diálogo sobre la misma rendición. Compara los kilómetros del GPS con los rendidos.
 */
@Component({
  selector: 'nt-recorrido-gps',
  imports: [Dialog, SelectButton, FormsModule, MapaRecorrido],
  template: `
    <p-dialog
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
      [header]="'Trazabilidad · ' + patente()"
      [modal]="true"
      [maximizable]="true"
      [draggable]="false"
      [dismissableMask]="true"
      appendTo="body"
      [style]="{ width: '96vw', maxWidth: '1400px' }"
      [contentStyle]="{ padding: '0' }"
      (onMaximize)="maximizado.set($event.maximized)"
    >
      <!-- Solo existe abierto: no consulta el GPS cada vez que se abre la rendición. -->
      @if (visible()) {
        <nt-mapa-recorrido
          class="recorrido"
          [class.maximizado]="maximizado()"
          [consulta]="consulta()"
          [kmRendidos]="kmRendidos()"
        >
          <div class="ventana">
            <div>
              <span class="etiqueta">Salida</span>
              <strong>{{ momento(salida()) }}</strong>
            </div>
            <i class="pi pi-arrow-right"></i>
            <div>
              <span class="etiqueta">Llegada</span>
              <strong>{{ llegada() ? momento(llegada()) : 'sin registrar' }}</strong>
            </div>
          </div>
          @if (!llegada()) {
            <p class="nota">Sin llegada registrada: se muestran 2 días desde la salida.</p>
          }
          <div class="margen">
            <span class="etiqueta">Margen</span>
            <p-selectbutton
              [options]="margenes"
              [ngModel]="margen()"
              (ngModelChange)="margen.set($event)"
              optionLabel="label"
              optionValue="value"
              [allowEmpty]="false"
              size="small"
              aria-label="Margen antes de la salida y después de la llegada"
            />
          </div>
        </nt-mapa-recorrido>
      }
    </p-dialog>
  `,
  styles: `
    .recorrido {
      height: min(78vh, 760px);
    }
    .recorrido.maximizado {
      height: calc(100vh - 4.5rem);
    }
    .ventana {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      i {
        color: var(--p-text-muted-color);
      }
      strong {
        display: block;
        font-size: 0.95rem;
      }
    }
    .etiqueta {
      display: block;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--p-text-muted-color);
    }
    .margen {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .nota {
      margin: 0;
      font-size: 0.8rem;
      color: var(--p-text-muted-color);
    }
  `,
})
export class RecorridoGps {
  readonly visible = model(false);
  readonly patente = input.required<string>();
  /** Salida y llegada de la rendición en hora de Chile: "AAAA-MM-DDTHH:mm". */
  readonly salida = input.required<string>();
  readonly llegada = input<string | null>(null);
  /** Kilómetros rendidos según los odómetros, para compararlos con el GPS. */
  readonly kmRendidos = input<number | null>(null);

  readonly margenes = [
    { label: 'Sin margen', value: 0 },
    { label: '± 1 h', value: 60 },
    { label: '± 3 h', value: 180 },
  ];
  readonly margen = signal(0);
  readonly maximizado = signal(false);

  /** Sin llegada se miran 2 días desde la salida; el margen amplía ambos extremos. */
  readonly consulta = computed<ConsultaRecorrido>(() => {
    const minutos = this.margen();
    const hasta = this.llegada() ?? desplazar(`${this.salida().slice(0, 10)}T23:59`, 24 * 60);
    return {
      patente: this.patente(),
      desde: desplazar(this.salida(), -minutos),
      hasta: desplazar(hasta, minutos),
    };
  });

  /** "AAAA-MM-DDTHH:mm" → "28/10 09:00". */
  momento(valor: string | null): string {
    if (!valor) return '—';
    const [, m, d] = valor.slice(0, 10).split('-');
    return `${d}/${m} ${valor.slice(11, 16)}`;
  }
}
