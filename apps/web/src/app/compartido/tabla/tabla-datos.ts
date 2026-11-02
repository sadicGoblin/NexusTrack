import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  contentChild,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FilterMatchMode } from 'primeng/api';
import { Button } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
import { Table, TableModule } from 'primeng/table';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import {
  diasEntre,
  ESTADO_ETIQUETA,
  formatearFecha,
  hoyIso,
  type ColumnaExportacion,
  type Estado,
} from '@nexustrack/shared';
import { ApiService } from '../../nucleo/api.service';
import { guardarPreferencia, leerPreferencia } from '../../nucleo/preferencias';
import {
  CorrelativoPipe,
  FechaPipe,
  NumeroPipe,
  PesosPipe,
  PorcentajePipe,
} from '../../nucleo/pipes';
import { Cargando } from '../cargando';
import { EstadoTag } from '../estado-tag';
import { CampoFecha } from '../formulario/campo-fecha';

export type TipoCelda =
  | 'texto'
  | 'fecha'
  | 'pesos'
  | 'numero'
  | 'decimal'
  | 'porcentaje'
  | 'booleano'
  | 'estado'
  | 'correlativo';
export type TipoFiltro = 'texto' | 'lista' | 'numero' | 'fecha' | 'booleano';

export interface ColumnaTabla {
  campo: string;
  titulo: string;
  tipo?: TipoCelda;
  /** Tipo de filtro de la columna; false para no filtrar. Por defecto se deduce del tipo. */
  filtro?: TipoFiltro | false;
  ancho?: string;
  /** Oculta por defecto (el usuario puede mostrarla desde el selector de columnas). */
  oculta?: boolean;
  /** Para fechas de vencimiento: colorea vencidas y próximas a vencer. */
  alertaVencimiento?: boolean;
}

/** Prefijos de los campos auxiliares que la tabla agrega para buscar y filtrar fechas y estados. */
const TXT = '__t_';
const FEC = '__d_';

const CLAVE_HERRAMIENTAS = 'nt-tabla-ordenar-filtrar';
/** Orden y filtros por columna: preferencia común a todas las grillas, apagada por defecto. */
const herramientasActivas = signal(leerPreferencia(CLAVE_HERRAMIENTAS) === 'si');

const filtroPorDefecto = (c: ColumnaTabla): TipoFiltro | false =>
  c.filtro !== undefined
    ? c.filtro
    : c.tipo === 'fecha'
      ? 'fecha'
      : c.tipo === 'booleano'
        ? 'booleano'
        : c.tipo === 'estado'
          ? 'lista'
          : c.tipo && ['pesos', 'numero', 'decimal', 'porcentaje', 'correlativo'].includes(c.tipo)
            ? 'numero'
            : 'texto';

/**
 * Grilla de datos estilo planilla: búsqueda global, filtros por columna y orden múltiple
 * (activables con un interruptor), selección de columnas visibles (recordada por navegador) y
 * exportación a Excel o PDF de exactamente lo que el usuario está viendo.
 */
@Component({
  selector: 'nt-tabla',
  imports: [
    TableModule,
    FormsModule,
    NgTemplateOutlet,
    Button,
    IconField,
    InputIcon,
    InputText,
    MultiSelect,
    ToggleSwitch,
    Tooltip,
    EstadoTag,
    Cargando,
    CampoFecha,
    FechaPipe,
    PesosPipe,
    NumeroPipe,
    PorcentajePipe,
    CorrelativoPipe,
  ],
  templateUrl: './tabla-datos.html',
  styleUrl: './tabla-datos.scss',
})
export class TablaDatos {
  private readonly api = inject(ApiService);

  readonly filas = input.required<object[]>();
  readonly columnas = input.required<ColumnaTabla[]>();
  readonly titulo = input.required<string>();
  /** Texto que acompaña al título en la exportación (por ejemplo, el rango de fechas). */
  readonly subtitulo = input<string>('');
  readonly cargando = input(false);
  /** Clave para recordar las columnas visibles en este navegador. */
  readonly claveEstado = input<string>('');
  readonly filasPorPagina = input(25);
  readonly clicable = input(true);
  /** Calcula la fila de totales (por campo) de las filas visibles: va al pie y a la exportación. */
  readonly totales = input<((filas: any[]) => Record<string, unknown>) | null>(null);
  /** Muestra los botones de Excel y PDF; se apagan si la página tiene su propia exportación. */
  readonly exportable = input(true);

  readonly seleccionar = output<any>();

  readonly acciones = contentChild<TemplateRef<unknown>>('acciones');
  readonly tabla = viewChild<Table>('tabla');

  readonly hoy = hoyIso();
  readonly busqueda = signal('');
  readonly exportando = signal<'pdf' | 'xlsx' | null>(null);
  private readonly visiblesElegidas = signal<string[] | null>(null);
  readonly cantidadFiltrada = signal<number | null>(null);
  /** Filas que dejan la búsqueda y los filtros; null si no hay ninguno activo. */
  private readonly filtradas = signal<object[] | null>(null);
  readonly herramientas = herramientasActivas.asReadonly();
  readonly ordenada = signal(false);
  private readonly conFiltrosDeColumna = signal(false);
  /** PrimeNG ordena el mismo arreglo de filas; cambiar esta señal lo rehace en el orden original. */
  private readonly reinicio = signal(0);

  /** Filas con campos auxiliares: texto formateado para la búsqueda y Date para filtrar fechas. */
  readonly filasProcesadas = computed(() => {
    this.reinicio();
    const columnas = this.columnas();
    return this.filas().map((f) => {
      const fila = { ...(f as Record<string, unknown>) };
      for (const c of columnas) {
        const v = fila[c.campo];
        if (c.tipo === 'fecha') {
          fila[TXT + c.campo] = formatearFecha(v as string);
          fila[FEC + c.campo] = v ? new Date(`${String(v).slice(0, 10)}T00:00:00`) : null;
        } else if (c.tipo === 'estado') {
          fila[TXT + c.campo] = ESTADO_ETIQUETA[v as Estado] ?? v;
        }
      }
      return fila;
    });
  });

  readonly camposBusqueda = computed(() =>
    this.columnas().flatMap((c) =>
      c.tipo === 'fecha' || c.tipo === 'estado' ? [TXT + c.campo] : [c.campo],
    ),
  );

  readonly visibles = computed(() => {
    const elegidas = this.visiblesElegidas() ?? this.leerVisibles();
    return this.columnas().filter((c) => (elegidas ? elegidas.includes(c.campo) : !c.oculta));
  });

  readonly seleccionColumnas = computed(() => this.visibles().map((c) => c.campo));

  /** Valores distintos por columna para los filtros de lista (como el autofiltro de Excel). */
  readonly opcionesLista = computed(() => {
    const opciones: Record<string, { label: string; value: unknown }[]> = {};
    for (const c of this.columnas()) {
      if (filtroPorDefecto(c) !== 'lista') continue;
      const valores = [
        ...new Set(this.filas().map((f) => (f as Record<string, unknown>)[c.campo])),
      ].filter((v) => v !== null && v !== undefined && v !== '');
      opciones[c.campo] = valores
        .map((v) => ({
          label: c.tipo === 'estado' ? (ESTADO_ETIQUETA[v as Estado] ?? String(v)) : String(v),
          value: v,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'es'));
    }
    return opciones;
  });

  readonly total = computed(() => this.filas().length);

  readonly filaTotales = computed(() => {
    const calcular = this.totales();
    return calcular ? calcular(this.filtradas() ?? this.filas()) : null;
  });

  constructor() {
    // Al apagar el orden y los filtros (aquí o en otra grilla abierta) no deben quedar filas
    // ocultas ni reordenadas sin que se vea por qué.
    effect(() => {
      if (!this.herramientas()) untracked(() => this.quitarOrdenYFiltros());
    });
  }

  alternarHerramientas(activas: boolean): void {
    herramientasActivas.set(activas);
    guardarPreferencia(CLAVE_HERRAMIENTAS, activas ? 'si' : 'no');
  }

  filtro(c: ColumnaTabla): TipoFiltro | false {
    return filtroPorDefecto(c);
  }

  campoFiltro(c: ColumnaTabla): string {
    return c.tipo === 'fecha' ? FEC + c.campo : c.campo;
  }

  esNumerica(c: ColumnaTabla): boolean {
    return !!c.tipo && ['pesos', 'numero', 'decimal', 'porcentaje', 'correlativo'].includes(c.tipo);
  }

  /** Clases de una celda: alineación numérica y alerta de vencimiento. */
  claseCelda(c: ColumnaTabla, valor: string | null): string {
    const clases = this.esNumerica(c) ? ['nt-derecha'] : [];
    if (c.alertaVencimiento && valor) {
      const dias = diasEntre(this.hoy, valor);
      if (dias < 0) clases.push('nt-vencido');
      else if (dias <= 30) clases.push('nt-por-vencer');
    }
    return clases.join(' ');
  }

  valor(fila: object, campo: string): any {
    return (fila as Record<string, unknown>)[campo];
  }

  buscar(texto: string): void {
    this.busqueda.set(texto);
    this.tabla()?.filterGlobal(texto, FilterMatchMode.CONTAINS);
  }

  alFiltrar(evento: { filteredValue?: unknown[] }): void {
    const conFiltros = Object.entries(this.tabla()?.filters ?? {}).some(([campo, f]) => {
      if (campo === 'global') return false;
      const lista = Array.isArray(f) ? f : [f];
      return lista.some(
        (x) =>
          x?.value !== null &&
          x?.value !== undefined &&
          !(Array.isArray(x.value) && !x.value.length),
      );
    });
    this.conFiltrosDeColumna.set(conFiltros);
    const filtrando = conFiltros || !!this.busqueda();
    this.cantidadFiltrada.set(filtrando ? (evento.filteredValue?.length ?? null) : null);
    this.filtradas.set(filtrando ? ((evento.filteredValue as object[]) ?? null) : null);
  }

  /** Quita la búsqueda, los filtros y el orden: las filas vuelven a como llegaron. */
  limpiar(): void {
    this.busqueda.set('');
    this.reiniciarTabla();
    this.cantidadFiltrada.set(null);
  }

  /** Quita filtros de columna y orden, y mantiene la búsqueda general. */
  private quitarOrdenYFiltros(): void {
    if (!this.ordenada() && !this.conFiltrosDeColumna()) return;
    this.reiniciarTabla();
    const t = this.tabla();
    if (this.busqueda()) t?.filterGlobal(this.busqueda(), FilterMatchMode.CONTAINS);
    else this.cantidadFiltrada.set(null);
  }

  private reiniciarTabla(): void {
    this.tabla()?.clear();
    this.reinicio.update((n) => n + 1);
    this.ordenada.set(false);
    this.conFiltrosDeColumna.set(false);
    this.filtradas.set(null);
  }

  elegirColumnas(campos: string[]): void {
    // Mantiene el orden original de las columnas.
    const orden = this.columnas()
      .map((c) => c.campo)
      .filter((c) => campos.includes(c));
    this.visiblesElegidas.set(orden);
    if (this.claveEstado())
      guardarPreferencia(`nt-columnas-${this.claveEstado()}`, JSON.stringify(orden));
  }

  private leerVisibles(): string[] | null {
    if (!this.claveEstado()) return null;
    try {
      return JSON.parse(leerPreferencia(`nt-columnas-${this.claveEstado()}`) ?? 'null');
    } catch {
      return null;
    }
  }

  /** Exporta las filas filtradas y ordenadas, con las columnas visibles. */
  async exportar(formato: 'pdf' | 'xlsx'): Promise<void> {
    const t = this.tabla();
    const filas = ((t?.filteredValue as object[] | null) ??
      t?.processedData ??
      this.filasProcesadas()) as Record<string, unknown>[];
    const columnas: ColumnaExportacion[] = this.visibles().map((c) => ({
      campo: c.campo,
      titulo: c.titulo,
      tipo:
        c.tipo === 'estado' || c.tipo === 'correlativo'
          ? c.tipo === 'correlativo'
            ? 'numero'
            : 'texto'
          : c.tipo,
    }));
    const planas = filas.map((f) =>
      Object.fromEntries(
        this.visibles().map((c) => [
          c.campo,
          c.tipo === 'estado' ? (ESTADO_ETIQUETA[f[c.campo] as Estado] ?? f[c.campo]) : f[c.campo],
        ]),
      ),
    );
    this.exportando.set(formato);
    try {
      await this.api.exportarTabla({
        titulo: this.titulo(),
        subtitulo: this.subtitulo() || undefined,
        formato,
        columnas,
        filas: planas,
        totales: this.filaTotales() ?? undefined,
      });
    } finally {
      this.exportando.set(null);
    }
  }
}
