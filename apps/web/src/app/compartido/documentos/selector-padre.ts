import { Component, input, output } from '@angular/core';
import { TablaDatos, type ColumnaTabla } from '../tabla/tabla-datos';

/** Paso previo a crear un documento hijo: elegir la orden de retiro o de carga activa. */
@Component({
  selector: 'nt-selector-padre',
  imports: [TablaDatos],
  template: `
    <div class="nt-tarjeta aviso">
      <i class="pi pi-info-circle"></i>
      <div>
        <strong>{{ titulo() }}</strong>
        <p>{{ instrucciones() }}</p>
      </div>
    </div>
    <nt-tabla
      [filas]="filas()"
      [columnas]="columnas()"
      [titulo]="titulo()"
      [cargando]="cargando()"
      [claveEstado]="'selector-' + titulo()"
      (seleccionar)="elegir.emit($event.id)"
    />
  `,
  styles: `
    .aviso {
      display: flex;
      gap: 0.75rem;
      align-items: flex-start;
      margin-bottom: 1rem;
      i {
        color: var(--p-primary-color);
        font-size: 1.2rem;
        margin-top: 0.15rem;
      }
      p {
        margin: 0.25rem 0 0;
        color: var(--p-text-muted-color);
      }
    }
  `,
})
export class SelectorPadre {
  readonly titulo = input.required<string>();
  readonly instrucciones = input.required<string>();
  readonly filas = input.required<object[]>();
  readonly columnas = input.required<ColumnaTabla[]>();
  readonly cargando = input(false);
  readonly elegir = output<number>();
}
