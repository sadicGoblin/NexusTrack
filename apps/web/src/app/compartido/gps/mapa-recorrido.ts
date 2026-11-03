import { HttpErrorResponse } from '@angular/common/http';
import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  type OnDestroy,
} from '@angular/core';
import type * as Leaflet from 'leaflet';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import {
  formatearNumero,
  ZONA_HORARIA,
  type ParadaRecorridoDto,
  type RecorridoDto,
  type ViajeRecorridoDto,
} from '@nexustrack/shared';
import { ApiService } from '../../nucleo/api.service';
import { guardarPreferencia, leerPreferencia } from '../../nucleo/preferencias';
import { Cargando } from '../cargando';

type L = typeof Leaflet;

/** Leaflet se carga recién al abrir el primer recorrido: no pesa en el resto de la aplicación. */
let cargaLeaflet: Promise<L> | null = null;
const leaflet = () =>
  (cargaLeaflet ??= import('leaflet').then((m) => (m as unknown as { default?: L }).default ?? m));

const COLORES = {
  ruta: '#6366f1',
  borde: '#ffffff',
  resaltado: '#f59e0b',
  inicio: '#22c55e',
  fin: '#ef4444',
};
const CLAVE_MAPA = 'nt-mapa-base';

/** Fila de la línea de tiempo: viajes y paradas intercalados en orden. */
type Evento =
  | { tipo: 'viaje'; n: number; dato: ViajeRecorridoDto }
  | { tipo: 'parada'; n: number; dato: ParadaRecorridoDto };

/** Qué recorrido mostrar: patente (rendición) o unidad del GPS, entre dos momentos de Chile. */
export interface ConsultaRecorrido {
  patente?: string;
  vehiculoId?: string;
  /** "AAAA-MM-DDTHH:mm" en hora de Chile. */
  desde: string;
  hasta: string;
}

/** "AAAA-MM-DDTHH:mm" ± minutos, sin pasar por la zona horaria del navegador. */
export function desplazar(momento: string, minutos: number): string {
  const [a, m, d, h, min] = momento.split(/[-T:]/).map(Number);
  return new Date(Date.UTC(a!, m! - 1, d!, h!, min! + minutos)).toISOString().slice(0, 16);
}

const formatoHora = new Intl.DateTimeFormat('es-CL', {
  timeZone: ZONA_HORARIA,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const formatoDia = new Intl.DateTimeFormat('es-CL', {
  timeZone: ZONA_HORARIA,
  day: '2-digit',
  month: '2-digit',
});

export function duracion(seg: number): string {
  if (!Number.isFinite(seg) || seg < 0) return '—';
  if (seg < 60) return `${Math.round(seg)} s`;
  const m = Math.round(seg / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

/**
 * Mapa de un recorrido GPS con su panel: resumen, viajes y paradas. Lo usan el diálogo de la
 * rendición y la página Trazabilidad; cada uno decide qué consultar y proyecta sus controles
 * arriba del panel.
 */
@Component({
  selector: 'nt-mapa-recorrido',
  imports: [Button, Message, Cargando],
  template: `
    <div class="mapa" #mapa></div>
    <aside class="panel">
      <ng-content />
      @if (!consulta()) {
        <p class="vacio">{{ indicacion() }}</p>
      } @else if (cargando()) {
        <nt-cargando class="estado" texto="Consultando el GPS…" />
      } @else if (error()) {
        <p-message severity="warn" class="estado">{{ error() }}</p-message>
        <p-button
          label="Reintentar"
          icon="pi pi-refresh"
          size="small"
          [text]="true"
          (onClick)="recargar()"
        />
      } @else if (recorrido(); as r) {
        @if (!r.resumen.puntos) {
          <p class="vacio">El GPS no registró posiciones de {{ r.vehiculo }} en este período.</p>
        } @else {
          <div class="cifras">
            <div class="cifra">
              <span>Distancia GPS</span>
              <strong>{{ km(r.resumen.distanciaKm) }} <small>km</small></strong>
              @if (kmRendidos() !== null) {
                <small [class.alerta]="diferenciaAlta()"
                  >Rendido: {{ km(kmRendidos()!) }} km (odómetro)</small
                >
              } @else if (r.resumen.odometroKm !== null) {
                <small>Odómetro GPS: {{ km(r.resumen.odometroKm) }} km</small>
              }
            </div>
            <div class="cifra">
              <span>Viajes</span>
              <strong>{{ r.resumen.viajes }}</strong>
              <small>{{ r.resumen.paradas }} paradas</small>
            </div>
            <div class="cifra">
              <span>En movimiento</span>
              <strong>{{ duracion(r.resumen.movimientoSeg) }}</strong>
              <small>Detenido {{ duracion(r.resumen.detenidoSeg) }}</small>
            </div>
            <div class="cifra">
              <span>Velocidad máx.</span>
              <strong>{{ r.resumen.velocidadMax }} <small>km/h</small></strong>
              <small>Promedio {{ km(r.resumen.velocidadPromedio, 0) }} km/h</small>
            </div>
          </div>
          <p class="nota">
            {{ r.vehiculo }} · {{ r.resumen.puntos }} posiciones · primera
            {{ momentoIso(r.resumen.primero) }}, última {{ momentoIso(r.resumen.ultimo) }} ·
            {{ fuentes[r.fuente] }}
            @if (r.truncado) {
              <span class="alerta"> · muestra parcial (período muy largo)</span>
            }
          </p>

          <div class="titulo-lista">
            <span>Viajes y paradas</span>
            @if (resaltado() !== null) {
              <p-button
                label="Quitar resaltado"
                size="small"
                [text]="true"
                (onClick)="quitarResaltado()"
              />
            }
          </div>
          <div class="eventos">
            @for (e of eventos(); track $index) {
              <button
                type="button"
                class="evento"
                [class.activo]="resaltado() === e"
                (click)="enfocar(e)"
              >
                @if (e.tipo === 'viaje') {
                  <span class="marca viaje"><i class="pi pi-truck"></i></span>
                  <span class="detalle">
                    <b>{{ hora(e.dato.inicio) }} → {{ hora(e.dato.fin) }}</b>
                    <small
                      >Viaje · {{ duracion(e.dato.duracionSeg) }} · máx
                      {{ e.dato.velocidadMax }} km/h</small
                    >
                  </span>
                  <span class="valor">{{ km(e.dato.distanciaKm) }} km</span>
                } @else {
                  <span class="marca parada" [class.apagado]="e.dato.motorApagado">{{ e.n }}</span>
                  <span class="detalle">
                    <b>{{ hora(e.dato.inicio) }} → {{ hora(e.dato.fin) }}</b>
                    <small
                      >Parada · motor {{ e.dato.motorApagado ? 'apagado' : 'encendido' }}</small
                    >
                  </span>
                  <span class="valor">{{ duracion(e.dato.duracionSeg) }}</span>
                }
              </button>
            }
          </div>
        }
      }

      <details class="ayuda">
        <summary>¿Cómo se calcula?</summary>
        <p>
          <b>Posiciones.</b> Reportes del equipo GPS de la unidad en el período consultado,
          guardados cada minuto. Horas de Chile.
        </p>
        <p>
          <b>Distancia.</b> Suma de los tramos entre posiciones; se descartan saltos imposibles del
          GPS. En una rendición se compara con los kilómetros rendidos (odómetros).
        </p>
        <p>
          <b>Viaje.</b> Tramo en movimiento entre dos paradas. Una detención menor a 5 minutos
          (semáforo, peaje) no corta el viaje.
        </p>
        <p>
          <b>Parada.</b> 5 minutos o más sin desplazarse más de 150 m. Naranja: motor encendido;
          gris: motor apagado.
        </p>
      </details>
    </aside>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 22rem;
      min-height: 0;
    }
    .mapa {
      min-height: 20rem;
      background: var(--nt-tabla-encabezado);
    }
    .panel {
      overflow-y: auto;
      padding: 1rem 1.1rem;
      border-left: 1px solid var(--p-content-border-color);
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .cifra span,
    .titulo-lista span {
      display: block;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--p-text-muted-color);
    }
    .nota {
      margin: 0;
      font-size: 0.8rem;
      color: var(--p-text-muted-color);
    }
    .alerta {
      color: var(--nt-alerta) !important;
      font-weight: 600;
    }
    .estado {
      display: block;
      padding: 1.5rem 0;
    }
    .vacio {
      color: var(--p-text-muted-color);
      text-align: center;
      padding: 1.5rem 0;
      margin: 0;
    }
    .cifras {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.6rem;
    }
    .cifra {
      border: 1px solid var(--p-content-border-color);
      border-radius: 10px;
      padding: 0.6rem 0.75rem;
      strong {
        display: block;
        font-size: 1.25rem;
        font-variant-numeric: tabular-nums;
        small {
          font-size: 0.75rem;
          font-weight: 500;
        }
      }
      > small {
        display: block;
        font-size: 0.75rem;
        color: var(--p-text-muted-color);
      }
    }
    .titulo-lista {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 2rem;
    }
    .eventos {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-top: -0.4rem;
    }
    .evento {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      width: 100%;
      padding: 0.45rem 0.5rem;
      border: none;
      border-radius: 8px;
      background: none;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
      &:hover {
        background: var(--p-content-hover-background);
      }
      &.activo {
        background: var(--p-highlight-background);
      }
    }
    .marca {
      flex: none;
      display: grid;
      place-items: center;
      width: 1.6rem;
      height: 1.6rem;
      border-radius: 50%;
      font-size: 0.72rem;
      font-weight: 700;
      color: #fff;
      &.viaje {
        background: ${COLORES.ruta};
        i {
          font-size: 0.75rem;
        }
      }
      &.parada {
        background: #f59e0b;
      }
      &.parada.apagado {
        background: #64748b;
      }
    }
    .detalle {
      flex: 1;
      min-width: 0;
      b {
        display: block;
        font-size: 0.85rem;
        font-variant-numeric: tabular-nums;
      }
      small {
        color: var(--p-text-muted-color);
        font-size: 0.75rem;
      }
    }
    .valor {
      font-size: 0.85rem;
      font-weight: 600;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .ayuda {
      margin-top: auto;
      font-size: 0.8rem;
      color: var(--p-text-muted-color);
      summary {
        cursor: pointer;
        color: var(--p-primary-color);
      }
      p {
        margin: 0.4rem 0 0;
      }
    }
    /* Íconos que crea Leaflet (fuera de la plantilla): estilo global. */
    ::ng-deep .nt-parada-gps {
      display: grid;
      place-items: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 2px solid #fff;
      background: #f59e0b;
      color: #fff;
      font: 700 11px/1 var(--nt-fuente);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
      &.apagado {
        background: #64748b;
      }
    }
    @media (max-width: 900px) {
      :host {
        grid-template-columns: 1fr;
        grid-template-rows: 55vh auto;
        height: auto !important;
      }
      .panel {
        border-left: none;
        border-top: 1px solid var(--p-content-border-color);
      }
    }
  `,
})
export class MapaRecorrido implements OnDestroy {
  private readonly api = inject(ApiService);

  readonly consulta = input<ConsultaRecorrido | null>(null);
  /** Kilómetros rendidos según los odómetros, para compararlos con el GPS. */
  readonly kmRendidos = input<number | null>(null);
  /** Texto mientras no hay nada que consultar. */
  readonly indicacion = input('Elija una unidad y un período.');

  private readonly elementoMapa = viewChild<ElementRef<HTMLElement>>('mapa');

  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly recorrido = signal<RecorridoDto | null>(null);
  readonly resaltado = signal<Evento | null>(null);
  readonly duracion = duracion;
  readonly fuentes: Record<RecorridoDto['fuente'], string> = {
    local: 'historial guardado',
    gps: 'consultado al GPS',
    mixta: 'historial guardado y GPS',
  };

  readonly eventos = computed<Evento[]>(() => {
    const r = this.recorrido();
    if (!r) return [];
    return [
      ...r.viajes.map((dato, i) => ({ tipo: 'viaje' as const, n: i + 1, dato })),
      ...r.paradas.map((dato, i) => ({ tipo: 'parada' as const, n: i + 1, dato })),
    ].sort((a, b) => a.dato.inicio.localeCompare(b.dato.inicio));
  });
  /** Más de 10 % entre los km del GPS y los rendidos: vale la pena revisar el odómetro. */
  readonly diferenciaAlta = computed(() => {
    const gps = this.recorrido()?.resumen.distanciaKm;
    const rendidos = this.kmRendidos();
    return !!gps && !!rendidos && Math.abs(gps - rendidos) / rendidos > 0.1;
  });
  private readonly varioDias = computed(() => {
    const r = this.recorrido();
    return !!r && formatoDia.format(new Date(r.desde)) !== formatoDia.format(new Date(r.hasta));
  });

  private L: L | null = null;
  private mapa: Leaflet.Map | null = null;
  private capaRuta: Leaflet.LayerGroup | null = null;
  private capaResaltado: Leaflet.LayerGroup | null = null;
  private limites: Leaflet.LatLngBounds | null = null;
  private observador?: ResizeObserver;
  private destruido = false;
  private consultaEnCurso = 0;
  private readonly mapaListo: Promise<void>;

  constructor() {
    let listo!: () => void;
    this.mapaListo = new Promise((r) => (listo = r));
    afterNextRender(() => void this.crearMapa().then(listo));
    effect(() => {
      const c = this.consulta();
      untracked(() => void this.cargar(c));
    });
  }

  ngOnDestroy(): void {
    this.destruido = true;
    this.observador?.disconnect();
    this.mapa?.remove();
  }

  /** Vuelve a consultar el mismo período (por ejemplo, tras un error). */
  recargar(): void {
    void this.cargar(this.consulta());
  }

  private async crearMapa(): Promise<void> {
    const elemento = this.elementoMapa()?.nativeElement;
    if (!elemento || this.mapa || this.destruido) return;
    const L = (this.L = await leaflet());
    const esri = 'Tiles © Esri — Maxar, Earthstar Geographics';
    const bases: Record<string, Leaflet.Layer> = {
      Satélite: L.layerGroup([
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 19, attribution: esri },
        ),
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 19 },
        ),
      ]),
      Calles: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }),
      Claro: L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        { maxZoom: 20, subdomains: 'abcd', attribution: '© OpenStreetMap © CARTO' },
      ),
    };
    const elegida = leerPreferencia(CLAVE_MAPA);
    const mapa = L.map(elemento, { zoomControl: true }).setView([-35.5, -71.5], 6);
    bases[elegida && bases[elegida] ? elegida : 'Satélite']!.addTo(mapa);
    L.control.layers(bases, undefined, { position: 'topright' }).addTo(mapa);
    mapa.on('baselayerchange', (e: Leaflet.LayersControlEvent) =>
      guardarPreferencia(CLAVE_MAPA, e.name),
    );
    this.capaRuta = L.layerGroup().addTo(mapa);
    this.capaResaltado = L.layerGroup().addTo(mapa);
    this.mapa = mapa;
    // En un diálogo el mapa nace mientras se abre, sin tamaño: al tenerlo, se vuelve a encuadrar.
    // Los cambios de tamaño se atienden una vez por cuadro y sin animar: Leaflet queda a medio
    // camino si se le cambia el tamaño durante una animación de zoom.
    let pendiente = 0;
    this.observador = new ResizeObserver(() => {
      cancelAnimationFrame(pendiente);
      pendiente = requestAnimationFrame(() => {
        const sinTamano = !mapa.getSize().x || !mapa.getSize().y;
        mapa.invalidateSize({ animate: false });
        if (sinTamano && this.limites) this.encuadrar(this.limites);
      });
    });
    this.observador.observe(elemento);
  }

  private async cargar(c: ConsultaRecorrido | null): Promise<void> {
    const consulta = ++this.consultaEnCurso;
    this.error.set(null);
    this.resaltado.set(null);
    if (!c) {
      this.recorrido.set(null);
      this.capaRuta?.clearLayers();
      return;
    }
    this.cargando.set(true);
    try {
      const r = await this.api.get<RecorridoDto>(
        'recorridos',
        { patente: c.patente, vehiculoId: c.vehiculoId, desde: c.desde, hasta: c.hasta },
        { sinAviso: true },
      );
      await this.mapaListo;
      if (consulta !== this.consultaEnCurso) return;
      this.recorrido.set(r);
      this.dibujar(r);
    } catch (e) {
      if (consulta !== this.consultaEnCurso) return;
      this.recorrido.set(null);
      this.capaRuta?.clearLayers();
      this.error.set(
        e instanceof HttpErrorResponse && e.status === 0
          ? 'No se pudo conectar con el servidor. Verifique su conexión.'
          : e instanceof HttpErrorResponse && e.error?.message
            ? e.error.message
            : 'No se pudo consultar el GPS.',
      );
    } finally {
      if (consulta === this.consultaEnCurso) this.cargando.set(false);
    }
  }

  private dibujar(r: RecorridoDto): void {
    const L = this.L;
    const mapa = this.mapa;
    if (!L || !mapa || !this.capaRuta) return;
    this.capaRuta.clearLayers();
    this.capaResaltado?.clearLayers();
    this.limites = null;
    const puntos = r.ruta.map((p) => [p[0], p[1]] as Leaflet.LatLngTuple);
    if (!puntos.length) return;
    if (puntos.length > 1) {
      L.polyline(puntos, { color: COLORES.borde, weight: 7, opacity: 0.6 }).addTo(this.capaRuta);
      L.polyline(puntos, { color: COLORES.ruta, weight: 3.5, opacity: 0.95 }).addTo(this.capaRuta);
    }
    const extremo = (punto: Leaflet.LatLngTuple, color: string, texto: string) =>
      L.circleMarker(punto, {
        radius: 7,
        color: '#fff',
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      })
        .bindTooltip(texto)
        .addTo(this.capaRuta!);
    extremo(puntos[0]!, COLORES.inicio, `Primera posición · ${this.momentoIso(r.resumen.primero)}`);
    if (puntos.length > 1)
      extremo(
        puntos.at(-1)!,
        COLORES.fin,
        `Última posición · ${this.momentoIso(r.resumen.ultimo)}`,
      );
    r.paradas.forEach((p, i) => {
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: '',
          html: `<span class="nt-parada-gps${p.motorApagado ? ' apagado' : ''}">${i + 1}</span>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
        zIndexOffset: 500,
      })
        .bindTooltip(
          `Parada ${i + 1} · ${duracion(p.duracionSeg)}<br>${this.hora(p.inicio)} → ${this.hora(p.fin)} · motor ${p.motorApagado ? 'apagado' : 'encendido'}`,
        )
        .addTo(this.capaRuta!);
    });
    this.limites = L.latLngBounds(puntos);
    this.encuadrar(this.limites);
  }

  private encuadrar(limites: Leaflet.LatLngBounds): void {
    this.mapa?.fitBounds(limites, { padding: [40, 40], maxZoom: 15, animate: false });
  }

  enfocar(e: Evento): void {
    const L = this.L;
    const r = this.recorrido();
    if (!L || !this.mapa || !r || !this.capaResaltado) return;
    if (this.resaltado() === e) return this.quitarResaltado();
    this.resaltado.set(e);
    this.capaResaltado.clearLayers();
    if (e.tipo === 'parada') {
      this.mapa.setView([e.dato.lat, e.dato.lng], Math.max(this.mapa.getZoom(), 15));
      return;
    }
    const desde = Date.parse(e.dato.inicio) / 1000;
    const hasta = Date.parse(e.dato.fin) / 1000;
    const puntos = r.ruta
      .filter((p) => p[2] >= desde && p[2] <= hasta)
      .map((p) => [p[0], p[1]] as Leaflet.LatLngTuple);
    if (puntos.length > 1) {
      L.polyline(puntos, { color: COLORES.resaltado, weight: 6, opacity: 0.95 }).addTo(
        this.capaResaltado,
      );
      this.mapa.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 15 });
    } else {
      this.mapa.setView([e.dato.desde.lat, e.dato.desde.lng], 14);
    }
  }

  quitarResaltado(): void {
    this.resaltado.set(null);
    this.capaResaltado?.clearLayers();
  }

  km(valor: number, decimales = 1): string {
    return formatearNumero(valor, decimales);
  }

  /** Hora de un instante (con el día si el recorrido abarca más de uno). */
  hora(iso: string): string {
    const d = new Date(iso);
    return this.varioDias()
      ? `${formatoDia.format(d)} ${formatoHora.format(d)}`
      : formatoHora.format(d);
  }

  momentoIso(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${formatoDia.format(d)} ${formatoHora.format(d)}`;
  }
}
