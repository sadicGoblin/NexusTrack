import { Component, computed, input } from '@angular/core';
import { Tag } from 'primeng/tag';
import { ESTADO_ETIQUETA, type Estado } from '@nexustrack/shared';

const SEVERIDAD: Record<Estado, 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'> =
  {
    ABIERTA: 'info',
    CON_CARGA: 'warn',
    CERRADA: 'success',
    RENDIDA: 'success',
    EMITIDO: 'success',
    ANULADA: 'danger',
    ANULADO: 'danger',
  };

/** Etiqueta de color para el estado de un documento. */
@Component({
  selector: 'nt-estado',
  imports: [Tag],
  template: `@if (estado()) {
    <p-tag [value]="etiqueta()" [severity]="severidad()" [rounded]="true" />
  }`,
})
export class EstadoTag {
  readonly estado = input<Estado | null | undefined>();
  readonly etiqueta = computed(() => (this.estado() ? ESTADO_ETIQUETA[this.estado()!] : ''));
  readonly severidad = computed(() => (this.estado() ? SEVERIDAD[this.estado()!] : 'secondary'));
}
