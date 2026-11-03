import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal, type OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { ZONA_HORARIA, type VehiculoGpsDto } from '@nexustrack/shared';
import { ApiService } from '../../nucleo/api.service';
import { guardarPreferencia, leerPreferencia } from '../../nucleo/preferencias';
import {
  desplazar,
  MapaRecorrido,
  type ConsultaRecorrido,
} from '../../compartido/gps/mapa-recorrido';

type Periodo = 'hoy' | 'ayer' | '24h' | '48h' | '7d' | '30d' | 'rango';

const CLAVE_UNIDAD = 'nt-trazabilidad-unidad';
const CLAVE_PERIODO = 'nt-trazabilidad-periodo';

/** Este momento en hora de Chile: "AAAA-MM-DDTHH:mm". */
function ahoraChile(): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONA_HORARIA,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return `${p['year']}-${p['month']}-${p['day']}T${p['hour']}:${p['minute']}`;
}

/** Fecha y hora del calendario (hora del navegador, en Chile) como "AAAA-MM-DDTHH:mm". */
function aMomento(d: Date): string {
  const n = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${n(d.getMonth() + 1)}-${n(d.getDate())}T${n(d.getHours())}:${n(d.getMinutes())}`;
}

/**
 * Trazabilidad: historial GPS de cualquier unidad del grupo entre fechas (ruta, viajes y
 * paradas), con lo que la API guarda cada minuto.
 */
@Component({
  selector: 'nt-trazabilidad',
  imports: [FormsModule, Select, SelectButton, DatePicker, Button, Message, MapaRecorrido],
  template: `
    <div class="nt-encabezado">
      <div>
        <h1>Trazabilidad</h1>
        <p>
          Historial GPS de cada unidad: ruta, viajes y paradas. Se consulta hasta 31 días por vez.
        </p>
      </div>
    </div>

    <div class="controles">
      <p-select
        class="unidad"
        [options]="unidades()"
        optionLabel="nombre"
        optionValue="id"
        [ngModel]="unidad()"
        (ngModelChange)="elegirUnidad($event)"
        [filter]="true"
        filterBy="nombre"
        placeholder="Elija una unidad"
        [loading]="cargandoUnidades()"
        appendTo="body"
        ariaLabel="Unidad"
      />
      <p-selectbutton
        [options]="periodos"
        [ngModel]="periodo()"
        (ngModelChange)="elegirPeriodo($event)"
        optionLabel="label"
        optionValue="value"
        [allowEmpty]="false"
        size="small"
        aria-label="Período"
      />
      @if (periodo() === 'rango') {
        <p-datepicker
          [ngModel]="desde()"
          (ngModelChange)="desde.set($event); actualizar()"
          [showTime]="true"
          hourFormat="24"
          dateFormat="dd/mm/yy"
          [showIcon]="true"
          iconDisplay="input"
          appendTo="body"
          placeholder="Desde"
          ariaLabel="Desde"
        />
        <p-datepicker
          [ngModel]="hasta()"
          (ngModelChange)="hasta.set($event); actualizar()"
          [showTime]="true"
          hourFormat="24"
          dateFormat="dd/mm/yy"
          [showIcon]="true"
          iconDisplay="input"
          appendTo="body"
          placeholder="Hasta"
          ariaLabel="Hasta"
        />
      }
      <p-button
        icon="pi pi-refresh"
        severity="secondary"
        [text]="true"
        [rounded]="true"
        (onClick)="actualizar()"
        [disabled]="!unidad()"
        ariaLabel="Actualizar hasta este momento"
      />
    </div>

    @if (error()) {
      <p-message severity="warn" class="aviso">{{ error() }}</p-message>
    }

    <nt-mapa-recorrido
      class="mapa"
      [consulta]="consulta()"
      indicacion="Elija una unidad para ver su recorrido."
    />
  `,
  styles: `
    .controles {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.6rem;
      margin-bottom: 1rem;
    }
    .unidad {
      width: 20rem;
      max-width: 100%;
    }
    .aviso {
      display: block;
      margin-bottom: 1rem;
    }
    .mapa {
      height: calc(100vh - 15rem);
      min-height: 30rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--nt-radio);
      overflow: hidden;
      background: var(--p-content-background);
      box-shadow: var(--nt-tarjeta-sombra);
    }
  `,
})
export class Trazabilidad implements OnInit {
  private readonly api = inject(ApiService);

  readonly unidades = signal<VehiculoGpsDto[]>([]);
  readonly cargandoUnidades = signal(true);
  readonly error = signal<string | null>(null);
  readonly unidad = signal<string | null>(leerPreferencia(CLAVE_UNIDAD));
  readonly periodo = signal<Periodo>((leerPreferencia(CLAVE_PERIODO) as Periodo) || 'hoy');
  readonly desde = signal<Date | null>(null);
  readonly hasta = signal<Date | null>(null);
  /** Período ya calculado: «Hoy» o «24 h» se fijan al elegirlos o al actualizar. */
  private readonly rango = signal<{ desde: string; hasta: string } | null>(null);

  readonly periodos = [
    { label: 'Hoy', value: 'hoy' },
    { label: 'Ayer', value: 'ayer' },
    { label: '24 h', value: '24h' },
    { label: '48 h', value: '48h' },
    { label: '7 días', value: '7d' },
    { label: '30 días', value: '30d' },
    { label: 'Entre fechas', value: 'rango' },
  ];

  readonly consulta = computed<ConsultaRecorrido | null>(() => {
    const unidad = this.unidad();
    const rango = this.rango();
    return unidad && rango ? { vehiculoId: unidad, ...rango } : null;
  });

  async ngOnInit(): Promise<void> {
    this.actualizar();
    try {
      const lista = await this.api.get<VehiculoGpsDto[]>('recorridos/vehiculos', undefined, {
        sinAviso: true,
      });
      this.unidades.set(lista);
      if (this.unidad() && !lista.some((u) => u.id === this.unidad())) this.unidad.set(null);
    } catch (e) {
      this.unidad.set(null);
      this.error.set(
        e instanceof HttpErrorResponse && e.error?.message
          ? e.error.message
          : 'No se pudo consultar el GPS.',
      );
    } finally {
      this.cargandoUnidades.set(false);
    }
  }

  elegirUnidad(id: string | null): void {
    this.unidad.set(id);
    if (id) guardarPreferencia(CLAVE_UNIDAD, id);
    this.actualizar();
  }

  elegirPeriodo(p: Periodo): void {
    this.periodo.set(p);
    guardarPreferencia(CLAVE_PERIODO, p);
    if (p === 'rango' && !this.desde()) {
      const hoy = new Date();
      this.desde.set(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
      this.hasta.set(hoy);
    }
    this.actualizar();
  }

  /** Recalcula el período hasta este momento (o el rango elegido en el calendario). */
  actualizar(): void {
    const ahora = ahoraChile();
    const hoy = ahora.slice(0, 10);
    const dias = (n: number) => desplazar(ahora, -n * 24 * 60);
    switch (this.periodo()) {
      case 'hoy':
        return this.rango.set({ desde: `${hoy}T00:00`, hasta: ahora });
      case 'ayer': {
        const ayer = desplazar(`${hoy}T00:00`, -24 * 60).slice(0, 10);
        return this.rango.set({ desde: `${ayer}T00:00`, hasta: `${ayer}T23:59` });
      }
      case '24h':
        return this.rango.set({ desde: dias(1), hasta: ahora });
      case '48h':
        return this.rango.set({ desde: dias(2), hasta: ahora });
      case '7d':
        return this.rango.set({ desde: dias(7), hasta: ahora });
      case '30d':
        return this.rango.set({ desde: dias(30), hasta: ahora });
      case 'rango': {
        const d = this.desde();
        const h = this.hasta();
        return this.rango.set(d && h ? { desde: aMomento(d), hasta: aMomento(h) } : null);
      }
    }
  }
}
