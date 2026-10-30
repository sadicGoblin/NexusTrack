import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import type { Permiso } from '@nexustrack/shared';
import { ApiService } from '../../nucleo/api.service';
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
}

/** Listado de documentos con filtro por fechas, grilla exportable y acceso al detalle. */
@Component({
  selector: 'nt-listado-documentos',
  imports: [TablaDatos, FiltroFechas, Button, RouterLink],
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
    <nt-tabla
      [filas]="filas()"
      [columnas]="config().columnas"
      [titulo]="config().titulo"
      [subtitulo]="rango()?.descripcion ?? ''"
      [cargando]="cargando()"
      [claveEstado]="config().claveEstado"
      (seleccionar)="abrir($event)"
    />
  `,
})
export class ListadoDocumentos {
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
