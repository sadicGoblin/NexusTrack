import { Component, computed, inject, signal, type OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { totalesControlFletes, type FilaControlFleteDto } from '@nexustrack/shared';
import { ApiService } from '../../nucleo/api.service';
import { DatosMaestrosService } from '../../nucleo/datos-maestros.service';
import { PesosPipe, PorcentajePipe } from '../../nucleo/pipes';
import { guardarPreferencia, leerPreferencia } from '../../nucleo/preferencias';
import { FiltroFechas, type RangoFechas } from '../../compartido/documentos/filtro-fechas';
import { TablaDatos, type ColumnaTabla } from '../../compartido/tabla/tabla-datos';
import { ESTILOS_INFORME } from './comun';

const TODOS = 'TODOS';
const CLAVE_ESTADO = 'nt-estado-control-fletes';

/**
 * Control de fletes: costos, margen y rentabilidad de cada flete, con las columnas y fórmulas de
 * la planilla del cliente. Solo consulta.
 */
@Component({
  selector: 'nt-control-fletes',
  imports: [TablaDatos, FiltroFechas, Select, SelectButton, FormsModule, PesosPipe, PorcentajePipe],
  template: `
    <div class="nt-encabezado">
      <div>
        <h1>Control de fletes</h1>
        <p>
          Costos, margen y rentabilidad de cada flete, calculados con las órdenes, vales y
          rendiciones emitidos. Se filtra por la fecha de la orden de retiro.
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

    <div class="resumen">
      <div class="cifra">
        <span>Valor de los fletes</span>
        <strong>{{ totales().valorFlete | pesos }}</strong>
        <small>{{ visibles().length }} {{ visibles().length === 1 ? 'flete' : 'fletes' }}</small>
      </div>
      <div class="cifra">
        <span>Costo total</span>
        <strong>{{ totales().costoTotal | pesos }}</strong>
        <small>Gastos, combustible y comisiones</small>
      </div>
      <div class="cifra" [class.favor]="totales().margen > 0" [class.contra]="totales().margen < 0">
        <span>Margen</span>
        <strong>{{ totales().margen | pesos }}</strong>
        <small>Valor de los fletes − costo total</small>
      </div>
      <div class="cifra">
        <span>Rentabilidad</span>
        <strong>{{ (totales().rentabilidad | porcentaje) || '—' }}</strong>
        <small>Margen / valor de los fletes</small>
      </div>
    </div>

    <nt-tabla
      [filas]="visibles()"
      [columnas]="columnas"
      titulo="Control de fletes"
      [subtitulo]="subtitulo()"
      [cargando]="cargando()"
      [totales]="calcularTotales"
      claveEstado="control-fletes"
      (seleccionar)="abrir($event)"
    />
  `,
  styles: ESTILOS_INFORME,
})
export class ControlFletes implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly maestros = inject(DatosMaestrosService);

  readonly filas = signal<FilaControlFleteDto[]>([]);
  readonly cargando = signal(true);
  readonly rango = signal<RangoFechas | null>(null);
  readonly clienteId = signal<number | null>(null);
  /** Estado elegido en los botones; se recuerda en este navegador, como en los listados. */
  readonly estado = signal<string>(TODOS);

  readonly calcularTotales = totalesControlFletes;

  readonly visibles = computed(() => {
    const e = this.estado();
    return e === TODOS ? this.filas() : this.filas().filter((f) => f.estado === e);
  });
  readonly totales = computed(() => totalesControlFletes(this.visibles()));
  readonly opcionesEstado = computed(() => {
    const filas = this.filas();
    const cuantos = (e: string) => filas.filter((f) => f.estado === e).length;
    return [
      { label: `Todos (${filas.length})`, value: TODOS },
      { label: `Por rendir (${cuantos('ABIERTA')})`, value: 'ABIERTA' },
      { label: `Rendidos (${cuantos('RENDIDA')})`, value: 'RENDIDA' },
    ];
  });
  readonly subtitulo = computed(() => {
    const cliente = this.maestros
      .opcionesClientes()
      .find((c) => c.value === this.clienteId())?.label;
    const estado = this.opcionesEstado()
      .find((o) => o.value === this.estado() && o.value !== TODOS)
      ?.label.replace(/ \(\d+\)$/, '');
    return [this.rango()?.descripcion, cliente, estado].filter(Boolean).join(' · ');
  });

  readonly columnas: ColumnaTabla[] = [
    { campo: 'conductor', titulo: 'Conductor', filtro: 'lista', ancho: '14rem' },
    { campo: 'fecha', titulo: 'Fecha', tipo: 'fecha' },
    { campo: 'ordenRetiro', titulo: 'Orden de Retiro', tipo: 'correlativo' },
    { campo: 'ordenCarga', titulo: 'Orden de Carga', tipo: 'correlativo' },
    { campo: 'rendicion', titulo: 'N° Rendición', tipo: 'correlativo' },
    { campo: 'estado', titulo: 'Estado', tipo: 'estado', oculta: true },
    { campo: 'fechaInicio', titulo: 'Fecha Inicio', tipo: 'fecha' },
    { campo: 'fechaTermino', titulo: 'Fecha Término', tipo: 'fecha' },
    { campo: 'cliente', titulo: 'Cliente', filtro: 'lista', ancho: '12rem' },
    { campo: 'tramo', titulo: 'Tramo', filtro: 'lista', ancho: '16rem' },
    { campo: 'distancia', titulo: 'Distancia', tipo: 'numero' },
    { campo: 'litrosCamion', titulo: 'Litros Camión', tipo: 'decimal' },
    { campo: 'kmPorLitro', titulo: 'Km/Lt', tipo: 'decimal' },
    { campo: 'horometro', titulo: 'Horómetro', tipo: 'decimal' },
    { campo: 'litrosRemolque', titulo: 'Litros Remolque', tipo: 'decimal' },
    { campo: 'litrosPorHora', titulo: 'Lt/Hr', tipo: 'decimal' },
    { campo: 'numerosAnticipo', titulo: 'N° Anticipo' },
    { campo: 'anticipo', titulo: 'Anticipo', tipo: 'pesos' },
    { campo: 'peajes', titulo: 'Peajes', tipo: 'pesos' },
    { campo: 'viatico', titulo: 'Viático', tipo: 'pesos' },
    { campo: 'cargaDescarga', titulo: 'Carga-Descarga', tipo: 'pesos' },
    { campo: 'petroleo', titulo: 'Petróleo', tipo: 'pesos' },
    { campo: 'otrosGastos', titulo: 'Otros Gastos', tipo: 'pesos' },
    { campo: 'totalGastos', titulo: 'Total Gastos', tipo: 'pesos' },
    { campo: 'saldo', titulo: 'Saldo', tipo: 'pesos' },
    { campo: 'combustible', titulo: 'Combustible', tipo: 'pesos' },
    { campo: 'comisiones', titulo: 'Comisiones', tipo: 'pesos' },
    { campo: 'costoTotal', titulo: 'Costo Total', tipo: 'pesos' },
    { campo: 'valorFlete', titulo: 'Valor Flete', tipo: 'pesos' },
    { campo: 'margen', titulo: 'Margen', tipo: 'pesos' },
    { campo: 'rentabilidad', titulo: 'Rentabilidad', tipo: 'porcentaje' },
  ];

  ngOnInit(): void {
    void this.maestros.asegurar('clientes');
    const guardado = leerPreferencia(CLAVE_ESTADO);
    if (guardado === 'ABIERTA' || guardado === 'RENDIDA') this.estado.set(guardado);
  }

  elegirEstado(e: string): void {
    this.estado.set(e);
    guardarPreferencia(CLAVE_ESTADO, e);
  }

  elegirCliente(id: number | null): void {
    this.clienteId.set(id);
    void this.cargar();
  }

  filtrar(rango: RangoFechas): void {
    this.rango.set(rango);
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    const rango = this.rango();
    if (!rango) return;
    this.cargando.set(true);
    try {
      this.filas.set(
        await this.api.get<FilaControlFleteDto[]>('informes/control-fletes', {
          desde: rango.desde,
          hasta: rango.hasta,
          clienteId: this.clienteId(),
        }),
      );
    } finally {
      this.cargando.set(false);
    }
  }

  /** Abre la rendición del flete o, si aún no se rinde, su orden de carga. */
  abrir(fila: FilaControlFleteDto): void {
    void this.router.navigate(
      fila.rendicionId
        ? ['/operacion/rendiciones', fila.rendicionId]
        : ['/operacion/ordenes-carga', fila.id],
    );
  }
}
