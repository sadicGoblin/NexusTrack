import { Component, input } from '@angular/core';

/** Dato en solo lectura (heredado de otro documento o calculado). */
@Component({
  selector: 'nt-dato',
  host: { class: 'nt-dato' },
  template: `<span class="etiqueta">{{ etiqueta() }}</span
    ><span class="valor">{{ valor() || '—' }}</span>`,
})
export class Dato {
  readonly etiqueta = input.required<string>();
  readonly valor = input<string | number | null | undefined>();
}
