import { Directive, ElementRef, inject } from '@angular/core';
import { NgControl } from '@angular/forms';

const SIGNIFICATIVO = /[0-9K]/i;

/** Solo dígitos y una K final, con un máximo de 9 caracteres (cuerpo de 8 dígitos y verificador). */
function limpiar(texto: string): string {
  const s = texto.replace(/[^0-9kK]/g, '').toUpperCase();
  return (s.slice(0, -1).replace(/K/g, '') + s.slice(-1)).slice(0, 9);
}

/** Formatea un RUT a medida que se escribe: el último carácter es el verificador (12.345.678-9). */
export function formatearRutParcial(texto: string): string {
  const limpio = limpiar(texto);
  if (limpio.length < 2) return limpio;
  const cuerpo = limpio
    .slice(0, -1)
    .replace(/^0+(?=\d)/, '')
    .replace(/\B(?=(\d{3})+$)/g, '.');
  return `${cuerpo}-${limpio.slice(-1)}`;
}

function contarSignificativos(texto: string): number {
  return [...texto].filter((c) => SIGNIFICATIVO.test(c)).length;
}

/** Posición del cursor después de `n` caracteres significativos. */
function posicionTras(texto: string, n: number): number {
  if (n <= 0) return 0;
  let vistos = 0;
  for (let i = 0; i < texto.length; i++)
    if (SIGNIFICATIVO.test(texto[i]) && ++vistos === n) return i + 1;
  return texto.length;
}

/** Agrega puntos y guion al RUT mientras se escribe, sin mover el cursor de lugar. */
@Directive({
  selector: 'input[ntRut]',
  host: {
    '(beforeinput)': 'anterior = input.value',
    '(input)': 'alEscribir($event)',
    autocomplete: 'off',
  },
})
export class RutInput {
  protected readonly input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private readonly control = inject(NgControl, { optional: true, self: true });
  protected anterior = '';

  alEscribir(evento: Event): void {
    const valor = this.input.value;
    let cursor = contarSignificativos(valor.slice(0, this.input.selectionStart ?? valor.length));
    let limpio = limpiar(valor);
    const tipo = (evento as InputEvent).inputType ?? '';
    // Si solo se borró un punto o el guion, se borra el dígito vecino; si no, volverían a aparecer.
    if (tipo.startsWith('delete') && limpio === limpiar(this.anterior)) {
      const i = tipo === 'deleteContentBackward' ? cursor - 1 : cursor;
      if (i >= 0 && i < limpio.length) {
        limpio = limpio.slice(0, i) + limpio.slice(i + 1);
        cursor = i;
      }
    }
    const nuevo = formatearRutParcial(limpio);
    if (nuevo === valor) return;
    this.input.value = nuevo;
    const posicion = posicionTras(nuevo, cursor);
    this.input.setSelectionRange(posicion, posicion);
    this.control?.control?.setValue(nuevo, { emitModelToViewChange: false });
  }
}
