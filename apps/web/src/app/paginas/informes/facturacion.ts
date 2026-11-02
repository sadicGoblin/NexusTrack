import { Component, computed, inject, signal, type OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import type {
  InformeFacturacionDto,
  LineaFacturacionDto,
  ResumenFacturacionDto,
} from '@nexustrack/shared';
import { ApiService } from '../../nucleo/api.service';
import { DatosMaestrosService } from '../../nucleo/datos-maestros.service';
import { PesosPipe } from '../../nucleo/pipes';
import { Dato } from '../../compartido/documentos/dato';
import { FiltroFechas, type RangoFechas } from '../../compartido/documentos/filtro-fechas';
import { TablaDatos, type ColumnaTabla } from '../../compartido/tabla/tabla-datos';
import { ESTILOS_INFORME } from './comun';

const sumar = <T>(filas: T[], valor: (f: T) => number) => filas.reduce((s, f) => s + valor(f), 0);

/**
 * Órdenes de carga por facturar: qué monto facturar y a quién. Sin cliente elegido muestra el
 * total por cliente; con cliente, el detalle y el informe para enviar (PDF o Excel).
 */
@Component({
  selector: 'nt-facturacion',
  imports: [TablaDatos, FiltroFechas, Dato, Select, Button, FormsModule, PesosPipe],
  template: `
    <div class="nt-encabezado">
      <div>
        <h1>Órdenes por facturar</h1>
        <p>
          Órdenes de carga con guías del período, valorizadas con sus tarifas. Se filtra por la
          fecha de la orden de carga; las anuladas no entran.
        </p>
      </div>
      <div class="nt-encabezado-acciones filtros">
        <p-select
          class="cliente"
          [options]="maestros.opcionesClientes()"
          optionLabel="label"
          optionValue="value"
          [ngModel]="clienteId()"
          (ngModelChange)="elegirCliente($event)"
          [filter]="true"
          filterBy="label,detalle"
          [showClear]="true"
          placeholder="Todos los clientes"
          appendTo="body"
          ariaLabel="Cliente"
        />
        <nt-filtro-fechas (cambio)="filtrar($event)" />
      </div>
    </div>

    @if (informe(); as i) {
      <section class="nt-tarjeta">
        <div class="nt-tarjeta-titulo">
          <h2>Informe órdenes de carga por facturar</h2>
          <div class="acciones">
            <p-button
              label="Todos los clientes"
              icon="pi pi-arrow-left"
              severity="secondary"
              [text]="true"
              size="small"
              (onClick)="elegirCliente(null)"
            />
            <p-button
              icon="pi pi-file-excel"
              label="Excel"
              severity="secondary"
              [outlined]="true"
              size="small"
              [loading]="descargando() === 'xlsx'"
              (onClick)="descargar('xlsx')"
            />
            <p-button
              icon="pi pi-file-pdf"
              label="PDF"
              size="small"
              [loading]="descargando() === 'pdf'"
              (onClick)="descargar('pdf')"
            />
          </div>
        </div>
        <div class="nt-grilla">
          <nt-dato etiqueta="Razón social" [valor]="i.cliente" class="nt-ancho-2" />
          <nt-dato etiqueta="RUT" [valor]="i.rut" />
          <nt-dato etiqueta="Período (desde-hasta)" [valor]="rango()?.descripcion" />
          <nt-dato etiqueta="Órdenes de carga" [valor]="ordenes()" />
          <nt-dato etiqueta="Valor total a facturar" [valor]="i.total | pesos" />
        </div>
      </section>

      <nt-tabla
        [filas]="lineas()"
        [columnas]="columnasDetalle"
        [titulo]="'Por facturar a ' + i.cliente"
        [cargando]="cargando()"
        [exportable]="false"
        [totales]="totalesDetalle"
        claveEstado="facturacion-detalle"
        (seleccionar)="abrir($event)"
      />
    } @else {
      <div class="resumen">
        <div class="cifra favor">
          <span>Total a facturar</span>
          <strong>{{ totalResumen() | pesos }}</strong>
          <small>{{ rango()?.descripcion }}</small>
        </div>
        <div class="cifra">
          <span>Clientes</span>
          <strong>{{ resumen().length }}</strong>
          <small>Con órdenes en el período</small>
        </div>
        <div class="cifra">
          <span>Órdenes de carga</span>
          <strong>{{ ordenesResumen() }}</strong>
          <small>Con guías registradas</small>
        </div>
      </div>
      <nt-tabla
        [filas]="resumen()"
        [columnas]="columnasResumen"
        titulo="Órdenes por facturar por cliente"
        [subtitulo]="rango()?.descripcion ?? ''"
        [cargando]="cargando()"
        [totales]="totalesResumen"
        claveEstado="facturacion-clientes"
        (seleccionar)="elegirCliente($event.clienteId)"
      />
    }
  `,
  styles: [
    ESTILOS_INFORME,
    `
      .acciones {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .nt-tarjeta {
        margin-bottom: 1rem;
      }
    `,
  ],
})
export class Facturacion implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly maestros = inject(DatosMaestrosService);

  readonly rango = signal<RangoFechas | null>(null);
  readonly clienteId = signal<number | null>(null);
  readonly resumen = signal<ResumenFacturacionDto[]>([]);
  readonly informe = signal<InformeFacturacionDto | null>(null);
  readonly cargando = signal(true);
  readonly descargando = signal<'pdf' | 'xlsx' | null>(null);

  readonly lineas = computed(() =>
    (this.informe()?.lineas ?? []).map((l) => ({ ...l, cliente: this.informe()!.cliente })),
  );
  readonly ordenes = computed(() => new Set(this.lineas().map((l) => l.ordenCargaId)).size);
  readonly totalResumen = computed(() => sumar(this.resumen(), (r) => r.total));
  readonly ordenesResumen = computed(() => sumar(this.resumen(), (r) => r.ordenes));

  readonly totalesResumen = (filas: ResumenFacturacionDto[]) => ({
    ordenes: sumar(filas, (r) => r.ordenes),
    guias: sumar(filas, (r) => r.guias),
    total: sumar(filas, (r) => r.total),
  });
  readonly totalesDetalle = (filas: LineaFacturacionDto[]) => ({
    total: sumar(filas, (l) => l.total),
  });

  readonly columnasResumen: ColumnaTabla[] = [
    { campo: 'cliente', titulo: 'Cliente', ancho: '18rem' },
    { campo: 'rut', titulo: 'RUT', ancho: '8.5rem' },
    { campo: 'ordenes', titulo: 'Órdenes de carga', tipo: 'numero' },
    { campo: 'guias', titulo: 'Guías', tipo: 'numero' },
    { campo: 'total', titulo: 'Total a facturar', tipo: 'pesos' },
  ];

  /** Columnas del informe de la planilla del cliente. */
  readonly columnasDetalle: ColumnaTabla[] = [
    { campo: 'cliente', titulo: 'Cliente', oculta: true },
    { campo: 'ordenCarga', titulo: 'N° Orden de Carga', tipo: 'correlativo' },
    { campo: 'fechaOrdenCarga', titulo: 'Fecha Orden de Carga', tipo: 'fecha' },
    { campo: 'guias', titulo: 'N° Guía' },
    { campo: 'fechaGuia', titulo: 'Fecha Guía', tipo: 'fecha' },
    { campo: 'especie', titulo: 'Especie', filtro: 'lista' },
    { campo: 'umEspecie', titulo: 'Unidad de Medida Especie', filtro: 'lista' },
    { campo: 'cantidadEspecie', titulo: 'Cantidad', tipo: 'decimal' },
    { campo: 'contenedor', titulo: 'N° Contenedor' },
    { campo: 'tramo', titulo: 'Tramo/Tarifa', filtro: 'lista', ancho: '16rem' },
    { campo: 'umTarifa', titulo: 'Unidad de Medida Tarifa', filtro: 'lista' },
    { campo: 'cantidadTarifa', titulo: 'Cantidad', tipo: 'decimal' },
    { campo: 'valorUnitario', titulo: 'Valor Unitario $', tipo: 'pesos' },
    { campo: 'total', titulo: 'Total $', tipo: 'pesos' },
  ];

  ngOnInit(): void {
    void this.maestros.asegurar('clientes');
  }

  elegirCliente(id: number | null): void {
    this.clienteId.set(id);
    void this.cargar();
  }

  filtrar(rango: RangoFechas): void {
    this.rango.set(rango);
    void this.cargar();
  }

  private get periodo() {
    return { desde: this.rango()?.desde, hasta: this.rango()?.hasta };
  }

  private async cargar(): Promise<void> {
    if (!this.rango()) return;
    const id = this.clienteId();
    this.cargando.set(true);
    try {
      if (id) {
        this.informe.set(
          await this.api.get<InformeFacturacionDto>(`informes/facturacion/${id}`, this.periodo),
        );
      } else {
        this.informe.set(null);
        this.resumen.set(
          await this.api.get<ResumenFacturacionDto[]>('informes/facturacion', this.periodo),
        );
      }
    } finally {
      this.cargando.set(false);
    }
  }

  async descargar(formato: 'pdf' | 'xlsx'): Promise<void> {
    const id = this.clienteId();
    if (!id) return;
    const { desde, hasta } = this.periodo;
    this.descargando.set(formato);
    try {
      await this.api.descargar(
        `informes/facturacion/${id}/${formato}?desde=${desde ?? ''}&hasta=${hasta ?? ''}`,
      );
    } finally {
      this.descargando.set(null);
    }
  }

  abrir(linea: LineaFacturacionDto): void {
    void this.router.navigate(['/operacion/ordenes-carga', linea.ordenCargaId]);
  }
}
