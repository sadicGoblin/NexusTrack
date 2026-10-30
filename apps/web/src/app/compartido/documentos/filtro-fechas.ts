import { Component, computed, effect, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { SelectButton } from 'primeng/selectbutton';
import { formatearFecha, hoyIso, rangoMes } from '@nexustrack/shared';
import { dateAIso, isoADate } from '../../nucleo/fechas';
import { CampoFecha } from '../formulario/campo-fecha';

export interface RangoFechas {
  desde: string;
  hasta: string;
  /** Descripción legible para la exportación ("Octubre 2026", "15/10/2026"). */
  descripcion: string;
}

type Modo = 'dia' | 'rango' | 'mes';

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/** Filtro de listados por día, entre días o por mes (por defecto, el mes actual). */
@Component({
  selector: 'nt-filtro-fechas',
  imports: [FormsModule, SelectButton, DatePicker, CampoFecha],
  template: `
    <div class="filtro">
      <p-selectbutton
        [options]="modos"
        [ngModel]="modo()"
        (ngModelChange)="modo.set($event)"
        optionLabel="label"
        optionValue="value"
        [allowEmpty]="false"
        size="small"
        aria-label="Tipo de filtro"
      />
      @switch (modo()) {
        @case ('dia') {
          <nt-fecha
            class="dia"
            [ngModel]="dia()"
            (ngModelChange)="dia.set($event)"
            ariaLabel="Día"
          />
        }
        @case ('rango') {
          <p-datepicker
            [ngModel]="rango()"
            (ngModelChange)="rango.set($event)"
            selectionMode="range"
            dateFormat="dd/mm/yy"
            [showIcon]="true"
            iconDisplay="input"
            [showButtonBar]="true"
            appendTo="body"
            [readonlyInput]="true"
            ariaLabel="Rango de fechas"
          />
        }
        @case ('mes') {
          <p-datepicker
            [ngModel]="mes()"
            (ngModelChange)="mes.set($event)"
            view="month"
            dateFormat="MM yy"
            [showIcon]="true"
            iconDisplay="input"
            [showButtonBar]="true"
            appendTo="body"
            [readonlyInput]="true"
            ariaLabel="Mes"
          />
        }
      }
    </div>
  `,
  styles: `
    .filtro {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .dia {
      width: 14rem;
    }
  `,
})
export class FiltroFechas {
  readonly cambio = output<RangoFechas>();

  readonly modos = [
    { label: 'Día', value: 'dia' },
    { label: 'Entre días', value: 'rango' },
    { label: 'Mes', value: 'mes' },
  ];
  readonly modo = signal<Modo>('mes');
  readonly dia = signal<Date | null>(isoADate(hoyIso()));
  readonly rango = signal<(Date | null)[] | null>(null);
  readonly mes = signal<Date | null>(isoADate(hoyIso()));

  readonly valor = computed<RangoFechas | null>(() => {
    switch (this.modo()) {
      case 'dia': {
        const d = dateAIso(this.dia());
        return d ? { desde: d, hasta: d, descripcion: formatearFecha(d) } : null;
      }
      case 'rango': {
        const [a, b] = this.rango() ?? [];
        const desde = dateAIso(a);
        const hasta = dateAIso(b ?? a);
        return desde && hasta
          ? {
              desde,
              hasta,
              descripcion: `Del ${formatearFecha(desde)} al ${formatearFecha(hasta)}`,
            }
          : null;
      }
      case 'mes': {
        const m = this.mes();
        if (!m) return null;
        return {
          ...rangoMes(m.getFullYear(), m.getMonth() + 1),
          descripcion: `${MESES[m.getMonth()]} ${m.getFullYear()}`,
        };
      }
    }
  });

  private ultimo = '';

  constructor() {
    effect(() => {
      const v = this.valor();
      if (!v) return;
      const clave = `${v.desde}|${v.hasta}`;
      if (clave === this.ultimo) return;
      this.ultimo = clave;
      this.cambio.emit(v);
    });
  }
}
