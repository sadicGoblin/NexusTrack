import { Component, input } from '@angular/core';
import { ProgressSpinner } from 'primeng/progressspinner';

/** Indicador de carga para una pantalla o sección mientras llegan sus datos. */
@Component({
  selector: 'nt-cargando',
  imports: [ProgressSpinner],
  host: { role: 'status', 'aria-live': 'polite' },
  template: `
    <p-progress-spinner
      strokeWidth="4"
      animationDuration="0.8s"
      [style]="{ width: tamano(), height: tamano() }"
      [ariaLabel]="texto()"
    />
    @if (texto()) {
      <span>{{ texto() }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      color: var(--p-text-muted-color);
      font-size: 0.9rem;
    }
    :host(.bloque) {
      flex-direction: column;
      padding: 4rem 1rem;
    }
    /* PrimeNG lo centra con márgenes automáticos; aquí lo centra el contenedor. */
    :host ::ng-deep .p-progressspinner {
      margin: 0;
    }
    /* Un solo color, el de la marca, en vez de la secuencia de colores de PrimeNG. */
    :host ::ng-deep .p-progressspinner-circle {
      stroke: var(--p-primary-color);
      animation: p-progressspinner-dash 1.5s ease-in-out infinite;
    }
  `,
})
export class Cargando {
  readonly texto = input('Cargando…');
  readonly tamano = input('2.25rem');
}
