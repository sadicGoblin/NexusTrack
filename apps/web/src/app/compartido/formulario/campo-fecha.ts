import {
  booleanAttribute,
  Component,
  computed,
  ElementRef,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule, NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { formatearFecha, hoyIso } from '@nexustrack/shared';
import { dateAIso, isoADate } from '../../nucleo/fechas';

const LARGOS = [2, 2, 4];

/** Agrega las barras al escribir solo números (27102026 → 27/10/2026); respeta las que se escriben. */
export function enmascararFecha(texto: string): string {
  if (!/^[\d/]*$/.test(texto)) return texto;
  const partes = [''];
  for (const c of texto) {
    const i = partes.length - 1;
    if (c === '/') {
      if (partes[i] && i < 2) partes.push('');
      continue;
    }
    if (partes[i].length === LARGOS[i]) {
      if (i === 2) break;
      partes.push('');
    }
    partes[partes.length - 1] += c;
  }
  return partes.join('/');
}

/**
 * Campo de fecha (dd/mm/aaaa) con calendario, barras automáticas al escribir y botón «Hoy».
 * El botón se muestra solo con el campo vacío, para no achicar una fecha ya escrita; el
 * calendario tiene el suyo. El valor es un `Date` local, como el de los calendarios de PrimeNG.
 */
@Component({
  selector: 'nt-fecha',
  imports: [FormsModule, DatePicker, Button, InputText],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CampoFecha), multi: true },
  ],
  host: { class: 'nt-fecha' },
  template: `
    @if (soloLectura()) {
      <input
        pInputText
        [id]="inputId()"
        [value]="texto()"
        [attr.aria-label]="ariaLabel()"
        [class]="claseInput()"
        readonly
      />
    } @else {
      <p-datepicker
        [inputId]="inputId()"
        [ngModel]="valor()"
        (ngModelChange)="elegir($event)"
        (onBlur)="alTocar()"
        dateFormat="dd/mm/yy"
        [showIcon]="true"
        iconDisplay="input"
        [showButtonBar]="true"
        appendTo="body"
        [fluid]="fluid()"
        placeholder="dd/mm/aaaa"
        [disabled]="deshabilitado()"
        [ariaLabel]="ariaLabel()"
        [inputStyleClass]="claseInput()"
      />
      @if (botonHoy() && !valor()) {
        <p-button
          label="Hoy"
          [text]="true"
          size="small"
          [disabled]="deshabilitado()"
          (onClick)="usarHoy()"
        />
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      min-width: 0;
    }
    :host > p-datepicker {
      flex: 1;
      min-width: 0;
    }
    :host ::ng-deep .p-button {
      flex-shrink: 0;
    }
  `,
})
export class CampoFecha implements ControlValueAccessor {
  readonly inputId = input<string>();
  readonly ariaLabel = input<string>();
  /** Clase del cuadro de texto (por ejemplo, un ancho fijo dentro de una tabla). */
  readonly claseInput = input<string>();
  readonly fluid = input(true, { transform: booleanAttribute });
  readonly botonHoy = input(true, { transform: booleanAttribute });
  readonly soloLectura = input(false, { transform: booleanAttribute });

  protected readonly valor = signal<Date | null>(null);
  protected readonly deshabilitado = signal(false);
  protected readonly texto = computed(() => formatearFecha(dateAIso(this.valor())));

  private alCambiar: (v: Date | null) => void = () => {};
  private alSalir: () => void = () => {};

  constructor() {
    // En fase de captura, para que el calendario reciba el texto ya con las barras.
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.addEventListener(
      'input',
      (e) => {
        const el = e.target as HTMLInputElement;
        if (el.tagName !== 'INPUT' || el.selectionStart !== el.value.length) return;
        const nuevo = enmascararFecha(el.value);
        if (nuevo !== el.value) el.value = nuevo;
      },
      true,
    );
  }

  writeValue(v: Date | null): void {
    this.valor.set(v ?? null);
  }

  registerOnChange(fn: (v: Date | null) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alSalir = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado.set(deshabilitado);
  }

  protected elegir(v: Date | null): void {
    this.valor.set(v);
    this.alCambiar(v);
  }

  protected alTocar(): void {
    this.alSalir();
  }

  protected usarHoy(): void {
    this.elegir(isoADate(hoyIso()));
    this.alSalir();
  }
}
