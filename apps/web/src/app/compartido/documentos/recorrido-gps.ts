import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  signal,
  viewChild,
  type OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type * as Leaflet from 'leaflet';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { SelectButton } from 'primeng/selectbutton';
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

/** "AAAA-MM-DDTHH:mm" ± minutos, sin pasar por la zona horaria del navegador. */
function desplazar(momento: string, minutos: number): string {
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
 * Recorrido GPS del camión entre la salida y la llegada de la rendición (solo historial), en un
 * diálogo sobre la misma rendición. Muestra la ruta, los viajes y las paradas, y compara los
 * kilómetros del GPS con los rendidos.
 */
@Component({
  selector: 'nt-recorrido-gps',
  imports: [Dialog, Button, SelectButton, Message, FormsModule, Cargando],
  template: `
    <p-dialog
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
      [header]="'Recorrido GPS · ' + patente()"
      [modal]="true"
      [maximizable]="true"
      [draggable]="false"
      [dismissableMask]="true"
      appendTo="body"
      [style]="{ width: '96vw', maxWidth: '1400px' }"
      [contentStyle]="{ padding: '0' }"
      (onShow)="alAbrir()"
      (onHide)="alCerrar()"
      (onMaximize)="maximizar($event.maximized)"
    >
      <div class="recorrido" [class.maximizado]="maximizado()">
        <div class="mapa" #mapa></div>
        <aside class="panel">
          <div class="ventana">
            <div>
              <span class="etiqueta">Salida</span>
              <strong>{{ momento(salida()) }}</strong>
            </div>
            <i class="pi pi-arrow-right"></i>
            <div>
              <span class="etiqueta">Llegada</span>
              <strong>{{ llegada() ? momento(llegada()) : 'sin registrar' }}</strong>
            </div>
          </div>
          @if (!llegada()) {
            <p class="nota">Sin llegada registrada: se muestran 2 días desde la salida.</p>
          }
          <div class="margen">
            <span>Margen</span>
            <p-selectbutton
              [options]="margenes"
              [ngModel]="margen()"
              (ngModelChange)="cambiarMargen($event)"
              optionLabel="label"
              optionValue="value"
              [allowEmpty]="false"
              size="small"
              aria-label="Margen antes de la salida y después de la llegada"
            />
          </div>

          @if (cargando()) {
            <nt-cargando class="estado" texto="Consultando el GPS…" />
          } @else if (error()) {
            <p-message severity="warn" class="estado">{{ error() }}</p-message>
            <p-button
              label="Reintentar"
              icon="pi pi-refresh"
              size="small"
              [text]="true"
              (onClick)="cargar()"
            />
          } @else if (recorrido(); as r) {
            @if (!r.resumen.puntos) {
              <p class="vacio">
                El GPS no registró posiciones de {{ r.vehiculo }} en este período.
              </p>
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
                {{ momentoIso(r.resumen.primero) }}, última {{ momentoIso(r.resumen.ultimo) }}
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
                      <span class="marca parada" [class.apagado]="e.dato.motorApagado">{{
                        e.n
                      }}</span>
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
              <b>Posiciones.</b> Reportes del equipo GPS del camión entre la salida y la llegada de
              la rendición (más el margen elegido). Horas de Chile.
            </p>
            <p>
              <b>Distancia.</b> Suma de los tramos entre posiciones; se descartan saltos imposibles
              del GPS. Se compara con los kilómetros rendidos según los odómetros.
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
      </div>
    </p-dialog>
  `,
  styles: `
    .recorrido {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 22rem;
      height: min(78vh, 760px);
    }
    .recorrido.maximizado {
      height: calc(100vh - 4.5rem);
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
    .ventana {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      i {
        color: var(--p-text-muted-color);
      }
      strong {
        display: block;
        font-size: 0.95rem;
      }
    }
    .etiqueta,
    .cifra span,
    .margen span,
    .titulo-lista span {
      display: block;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--p-text-muted-color);
    }
    .margen {
      display: flex;
      align-items: center;
      gap: 0.6rem;
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
      .recorrido {
        grid-template-columns: 1fr;
        grid-template-rows: 55vh auto;
        height: auto;
      }
      .panel {
        border-left: none;
        border-top: 1px solid var(--p-content-border-color);
      }
    }
  `,
})
export class RecorridoGps implements OnDestroy {
  private readonly api = inject(ApiService);

  readonly visible = model(false);
  readonly patente = input.required<string>();
  /** Salida y llegada de la rendición en hora de Chile: "AAAA-MM-DDTHH:mm". */
  readonly salida = input.required<string>();
  readonly llegada = input<string | null>(null);
  /** Kilómetros rendidos según los odómetros, para compararlos con el GPS. */
  readonly kmRendidos = input<number | null>(null);

  private readonly elementoMapa = viewChild<ElementRef<HTMLElement>>('mapa');

  readonly margenes = [
    { label: 'Sin margen', value: 0 },
    { label: '± 1 h', value: 60 },
    { label: '± 3 h', value: 180 },
  ];
  readonly margen = signal(0);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly recorrido = signal<RecorridoDto | null>(null);
  readonly resaltado = signal<Evento | null>(null);
  readonly maximizado = signal(false);
  readonly duracion = duracion;

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
  private consulta = 0;

  async alAbrir(): Promise<void> {
    await this.crearMapa();
    await this.cargar();
  }

  alCerrar(): void {
    this.mapa?.remove();
    this.mapa = null;
    this.resaltado.set(null);
  }

  ngOnDestroy(): void {
    this.mapa?.remove();
  }

  ajustarMapa(): void {
    setTimeout(() => this.mapa?.invalidateSize(), 250);
  }

  maximizar(maximizado: boolean): void {
    this.maximizado.set(maximizado);
    this.ajustarMapa();
  }

  cambiarMargen(minutos: number): void {
    this.margen.set(minutos);
    void this.cargar();
  }

  private async crearMapa(): Promise<void> {
    const elemento = this.elementoMapa()?.nativeElement;
    if (!elemento || this.mapa) return;
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
    this.ajustarMapa();
  }

  async cargar(): Promise<void> {
    const consulta = ++this.consulta;
    const minutos = this.margen();
    const llegada = this.llegada() ?? `${this.salida().slice(0, 10)}T23:59`;
    const hasta = this.llegada() ? llegada : desplazar(llegada, 24 * 60);
    this.cargando.set(true);
    this.error.set(null);
    this.resaltado.set(null);
    try {
      const r = await this.api.get<RecorridoDto>(
        'recorridos',
        {
          patente: this.patente(),
          desde: desplazar(this.salida(), -minutos),
          hasta: desplazar(hasta, minutos),
        },
        { sinAviso: true },
      );
      if (consulta !== this.consulta) return;
      this.recorrido.set(r);
      this.dibujar(r);
    } catch (e) {
      if (consulta !== this.consulta) return;
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
      if (consulta === this.consulta) this.cargando.set(false);
    }
  }

  private dibujar(r: RecorridoDto): void {
    const L = this.L;
    const mapa = this.mapa;
    if (!L || !mapa || !this.capaRuta) return;
    this.capaRuta.clearLayers();
    this.capaResaltado?.clearLayers();
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
    mapa.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 15 });
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

  /** "AAAA-MM-DDTHH:mm" → "28/10 09:00". */
  momento(valor: string | null): string {
    if (!valor) return '—';
    const [, m, d] = valor.slice(0, 10).split('-');
    return `${d}/${m} ${valor.slice(11, 16)}`;
  }
}
