import { Component, computed, inject, input, signal, type OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';
import { ESTADO_ETIQUETA, type Estado, type Permiso } from '@nexustrack/shared';
import { ApiService } from '../../nucleo/api.service';
import { guardarPreferencia, leerPreferencia } from '../../nucleo/preferencias';
import { SesionService } from '../../nucleo/sesion.service';
import { TablaDatos, type ColumnaTabla } from '../tabla/tabla-datos';
import { FiltroFechas, type RangoFechas } from './filtro-fechas';

export interface ConfigListado {
  titulo: string;
  descripcion: string;
  recurso: string;
  columnas: ColumnaTabla[];
  claveEstado: string;
  etiquetaNuevo: string;
  permisoNuevo: Permiso;
  /** Convierte cada documento en una fila plana para la grilla. */
  aplanar?: (doc: any) => Record<string, unknown>;
  /** Estados que se ofrecen como botones de filtro rápido, en ese orden. */
  estados: Estado[];
  /** Texto del botón sin filtro: "Todas" o "Todos". */
  todos: string;
}

const TODOS = 'TODOS';

/**
 * Listado de documentos con filtro por fechas, botones por estado (un clic, sin activar los
 * filtros de la grilla), grilla exportable y acceso al detalle.
 */
@Component({
  selector: 'nt-listado-documentos',
  imports: [TablaDatos, FiltroFechas, Button, RouterLink, SelectButton, FormsModule],
  template: `
    <div class="nt-encabezado">
      <div>
        <h1>{{ config().titulo }}</h1>
        <p>{{ config().descripcion }}</p>
      </div>
      <div class="nt-encabezado-acciones">
        <nt-filtro-fechas (cambio)="filtrar($event)" />
        @if (puedeCrear()) {
          <p-button [label]="config().etiquetaNuevo" icon="pi pi-plus" routerLink="nuevo" />
        }
      </div>
    </div>
    <p-selectbutton
      class="estados"
      [options]="opcionesEstado()"
      [ngModel]="estado()"
      (ngModelChange)="elegirEstado($event)"
      optionLabel="label"
      optionValue="value"
      [allowEmpty]="false"
      size="small"
      aria-label="Filtrar por estado"
    />
    <nt-tabla
      [filas]="visibles()"
      [columnas]="config().columnas"
      [titulo]="config().titulo"
      [subtitulo]="subtitulo()"
      [cargando]="cargando()"
      [claveEstado]="config().claveEstado"
      (seleccionar)="abrir($event)"
    />
  `,
  styles: `
    .estados {
      display: flex;
      flex-wrap: wrap;
      margin-bottom: 0.75rem;
    }
  `,
})
export class ListadoDocumentos implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly sesion = inject(SesionService);

  readonly config = input.required<ConfigListado>();

  readonly documentos = signal<any[]>([]);
  readonly cargando = signal(true);
  readonly rango = signal<RangoFechas | null>(null);
  readonly puedeCrear = computed(() => this.sesion.puede(this.config().permisoNuevo));
  readonly filas = computed(() => {
    const aplanar = this.config().aplanar;
    return aplanar ? this.documentos().map(aplanar) : this.documentos();
  });
  /** Estado elegido en los botones; se recuerda por listado en este navegador. */
  readonly estado = signal<string>(TODOS);
  readonly visibles = computed(() => {
    const e = this.estado();
    return e === TODOS ? this.filas() : this.filas().filter((f) => f['estado'] === e);
  });
  readonly opcionesEstado = computed(() => {
    const filas = this.filas();
    const cuantos = (e: string) => filas.filter((f) => f['estado'] === e).length;
    return [
      { label: `${this.config().todos} (${filas.length})`, value: TODOS },
      ...this.config().estados.map((e) => ({
        label: `${ESTADO_ETIQUETA[e]} (${cuantos(e)})`,
        value: e,
      })),
    ];
  });
  readonly subtitulo = computed(() => {
    const rango = this.rango()?.descripcion ?? '';
    const e = this.estado();
    return e === TODOS ? rango : `${rango} · ${ESTADO_ETIQUETA[e as Estado]}`;
  });

  private get clavePreferencia(): string {
    return `nt-estado-${this.config().claveEstado}`;
  }

  ngOnInit(): void {
    const guardado = leerPreferencia(this.clavePreferencia);
    if (guardado && this.config().estados.includes(guardado as Estado)) this.estado.set(guardado);
  }

  elegirEstado(e: string): void {
    this.estado.set(e);
    guardarPreferencia(this.clavePreferencia, e);
  }

  async filtrar(rango: RangoFechas): Promise<void> {
    this.rango.set(rango);
    this.cargando.set(true);
    try {
      this.documentos.set(
        await this.api.get<any[]>(this.config().recurso, {
          desde: rango.desde,
          hasta: rango.hasta,
        }),
      );
    } finally {
      this.cargando.set(false);
    }
  }

  abrir(fila: { id: number }): void {
    void this.router.navigate([this.router.url.split('?')[0], fila.id]);
  }
}
