import {
  booleanAttribute,
  Component,
  ElementRef,
  forwardRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';
import { Button } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Popover } from 'primeng/popover';

const dos = (n: number) => String(n).padStart(2, '0');
const HORAS = Array.from({ length: 24 }, (_, i) => dos(i));
const MINUTOS = Array.from({ length: 60 }, (_, i) => dos(i));

/**
 * Agrega los dos puntos al escribir solo números: 1430 → 14:30, 930 → 9:30. Sin dos puntos al
 * final, para que borrar funcione como siempre.
 */
export function enmascararHora(texto: string): string {
  if (!/^[\d:]*$/.test(texto)) return texto;
  if (texto.includes(':')) {
    const [h, m = ''] = texto.split(':');
    return `${h.slice(0, 2)}:${m.slice(0, 2)}`;
  }
  if (texto.length < 3) return texto;
  const largoHora = Number(texto.slice(0, 2)) <= 23 ? 2 : 1;
  return `${texto.slice(0, largoHora)}:${texto.slice(largoHora, largoHora + 2)}`;
}

/** Hora escrita a HH:mm: "9" → 09:00, "9:5" → 09:05, "1430" → 14:30. Null si no es una hora. */
export function normalizarHora(texto: string): string | null {
  const t = enmascararHora(texto.trim());
  const m = /^(\d{1,2})(?::(\d{0,2}))?$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] || 0);
  return h <= 23 && min <= 59 ? `${dos(h)}:${dos(min)}` : null;
}

/**
 * Campo de hora de 24 horas (HH:mm). Se escribe directo o se elige en un panel con todas las
 * horas (00 a 23) y todos los minutos (00 a 59), igual en cualquier navegador y sin a. m./p. m.
 */
@Component({
  selector: 'nt-hora',
  imports: [Popover, Button, IconField, InputIcon, InputText],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CampoHora), multi: true },
  ],
  template: `
    <p-iconfield iconPosition="right" class="campo">
      <input
        #entrada
        pInputText
        [id]="inputId()"
        [value]="texto()"
        [readonly]="soloLectura()"
        [disabled]="deshabilitado()"
        [attr.aria-label]="ariaLabel()"
        placeholder="hh:mm"
        inputmode="numeric"
        maxlength="5"
        autocomplete="off"
        (input)="escribir(entrada)"
        (blur)="salir()"
        (click)="!soloLectura() && abrir($event)"
        (keydown.arrowdown)="!soloLectura() && abrir($event)"
      />
      @if (!soloLectura()) {
        <p-inputicon
          class="pi pi-clock reloj"
          role="button"
          aria-label="Elegir hora"
          (click)="!deshabilitado() && panel.toggle($event, entrada)"
        />
      }
    </p-iconfield>

    <p-popover
      #panel
      appendTo="body"
      [focusOnShow]="false"
      (onShow)="mostrarElegidos()"
      (onHide)="alSalir()"
    >
      <div class="selector" role="group" aria-label="Elegir hora">
        <div class="columna">
          <div class="titulo">Hora</div>
          <div class="lista" #listaHoras>
            @for (h of horas; track h) {
              <button
                type="button"
                [class.elegido]="h === hora()"
                [attr.aria-pressed]="h === hora()"
                (click)="elegirHora(h)"
              >
                {{ h }}
              </button>
            }
          </div>
        </div>
        <div class="columna">
          <div class="titulo">Minutos</div>
          <div class="lista" #listaMinutos>
            @for (m of minutos; track m) {
              <button
                type="button"
                [class.elegido]="m === minuto()"
                [attr.aria-pressed]="m === minuto()"
                (click)="elegirMinuto(m)"
              >
                {{ m }}
              </button>
            }
          </div>
        </div>
      </div>
      <div class="pie">
        <p-button label="Ahora" [text]="true" size="small" (onClick)="usarAhora()" />
        <p-button label="Listo" [text]="true" size="small" (onClick)="panel.hide()" />
      </div>
    </p-popover>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .campo,
    .campo input {
      width: 100%;
    }
    .reloj {
      cursor: pointer;
    }
    .selector {
      display: flex;
      gap: 0.5rem;
    }
    .columna {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .titulo {
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--p-text-muted-color);
      padding-bottom: 0.35rem;
    }
    .lista {
      display: flex;
      flex-direction: column;
      gap: 2px;
      height: 14rem;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 0 0.25rem;
      scrollbar-width: thin;
    }
    .lista button {
      flex-shrink: 0;
      width: 3.25rem;
      padding: 0.35rem 0;
      border: none;
      border-radius: 6px;
      background: none;
      color: var(--p-text-color);
      font: inherit;
      font-variant-numeric: tabular-nums;
      cursor: pointer;
    }
    .lista button:hover {
      background: var(--p-content-hover-background);
    }
    .lista button:focus-visible {
      outline: 2px solid var(--p-primary-color);
      outline-offset: -2px;
    }
    .lista button.elegido {
      background: var(--p-primary-color);
      color: var(--p-primary-contrast-color);
      font-weight: 600;
    }
    .pie {
      display: flex;
      justify-content: space-between;
      border-top: 1px solid var(--p-content-border-color);
      margin-top: 0.5rem;
      padding-top: 0.35rem;
    }
  `,
})
export class CampoHora implements ControlValueAccessor {
  readonly inputId = input<string>();
  readonly ariaLabel = input<string>();
  readonly soloLectura = input(false, { transform: booleanAttribute });

  protected readonly horas = HORAS;
  protected readonly minutos = MINUTOS;
  protected readonly texto = signal('');
  protected readonly hora = signal<string | null>(null);
  protected readonly minuto = signal<string | null>(null);
  protected readonly deshabilitado = signal(false);

  private readonly panel = viewChild.required<Popover>('panel');
  private readonly entrada = viewChild.required<ElementRef<HTMLInputElement>>('entrada');
  private readonly listaHoras = viewChild<ElementRef<HTMLElement>>('listaHoras');
  private readonly listaMinutos = viewChild<ElementRef<HTMLElement>>('listaMinutos');

  private valor: string | null = null;
  private alCambiar: (v: string | null) => void = () => {};
  protected alSalir: () => void = () => {};

  writeValue(v: string | null): void {
    this.fijar(v ?? null, false);
  }

  registerOnChange(fn: (v: string | null) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alSalir = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado.set(deshabilitado);
  }

  protected abrir(evento: Event): void {
    if (!this.deshabilitado() && !this.panel().overlayVisible) {
      this.panel().show(evento, this.entrada().nativeElement);
    }
  }

  protected escribir(el: HTMLInputElement): void {
    if (el.selectionStart === el.value.length) {
      const nuevo = enmascararHora(el.value);
      if (nuevo !== el.value) el.value = nuevo;
    }
    this.texto.set(el.value);
    // Una hora completa se toma al instante; lo incompleto se resuelve al salir del campo.
    if (/^\d{1,2}:\d{2}$/.test(el.value)) {
      const hora = normalizarHora(el.value);
      if (hora) this.fijar(hora, true, false);
    } else if (!el.value) {
      this.fijar(null, true);
    }
  }

  protected salir(): void {
    const t = this.texto().trim();
    if (!t) this.fijar(null, true);
    else this.fijar(normalizarHora(t) ?? this.valor, true);
    if (!this.panel().overlayVisible) this.alSalir();
  }

  protected elegirHora(h: string): void {
    this.fijar(`${h}:${this.minuto() ?? '00'}`, true);
  }

  protected elegirMinuto(m: string): void {
    this.fijar(`${this.hora() ?? '00'}:${m}`, true);
    this.panel().hide();
    this.entrada().nativeElement.focus();
  }

  protected usarAhora(): void {
    const ahora = new Date();
    this.fijar(`${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`, true);
    this.panel().hide();
  }

  /** Deja a la vista la hora y el minuto elegidos al abrir el panel. */
  protected mostrarElegidos(): void {
    setTimeout(() => {
      for (const lista of [this.listaHoras(), this.listaMinutos()]) {
        const el = lista?.nativeElement.querySelector<HTMLElement>('.elegido');
        if (el) el.parentElement!.scrollTop = el.offsetTop - el.parentElement!.offsetTop - 80;
      }
    });
  }

  private fijar(v: string | null, avisar: boolean, reescribir = true): void {
    const [h, m] = v ? v.split(':') : [null, null];
    this.hora.set(h);
    this.minuto.set(m);
    if (reescribir) this.texto.set(v ?? '');
    const cambio = v !== this.valor;
    this.valor = v;
    if (avisar && cambio) this.alCambiar(v);
  }
}
