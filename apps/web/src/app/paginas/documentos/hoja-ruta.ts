import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { TIPO_RENDICION_ETIQUETA, type HojaRutaDetalleDto } from '@nexustrack/shared';
import { ApiService } from '../../nucleo/api.service';
import { CorrelativoPipe, FechaPipe, NumeroPipe, PesosPipe } from '../../nucleo/pipes';
import { SesionService } from '../../nucleo/sesion.service';
import { Cargando } from '../../compartido/cargando';
import { BarraDocumento } from '../../compartido/documentos/barra-documento';
import { Dato } from '../../compartido/documentos/dato';
import { RecorridoGps } from '../../compartido/documentos/recorrido-gps';
import { ResumenRetiro } from '../../compartido/documentos/resumen-retiro';

/**
 * Hoja de ruta de un flete o de una estadía (solo lectura): datos del viaje, sus documentos, las
 * guías y lo rendido, como en la rendición.
 */
@Component({
  selector: 'nt-hoja-ruta',
  imports: [
    BarraDocumento,
    Cargando,
    Dato,
    ResumenRetiro,
    RecorridoGps,
    RouterLink,
    Button,
    CorrelativoPipe,
    FechaPipe,
    NumeroPipe,
    PesosPipe,
  ],
  template: `
    <nt-barra-documento
      titulo="Hoja de ruta"
      [subtitulo]="subtitulo()"
      [numero]="h()?.numero ?? null"
      [estado]="h()?.estado ?? null"
      [recurso]="'hojas-ruta/' + h()?.id"
      volver="/operacion/hojas-ruta"
    >
      @if (salidaGps()) {
        <p-button
          label="Trazabilidad"
          icon="pi pi-map-marker"
          severity="secondary"
          [outlined]="true"
          (onClick)="mostrarRecorrido.set(true)"
        />
      }
    </nt-barra-documento>
    @if (!h()) {
      <nt-cargando class="bloque" />
    }

    @if (h(); as h) {
      <section class="nt-tarjeta">
        <div class="nt-tarjeta-titulo"><h2>Hoja de ruta</h2></div>
        <div class="nt-grilla">
          <nt-dato etiqueta="Fecha" [valor]="(h.fecha | fecha) + (h.hora ? ' ' + h.hora : '')" />
          <nt-dato etiqueta="Tipo" [valor]="tipo()" />
          <nt-dato etiqueta="Origen" [valor]="h.origen" />
          <nt-dato etiqueta="Destino" [valor]="h.destino" />
          <nt-dato etiqueta="Chofer" [valor]="h.conductor" class="nt-ancho-2" />
          <nt-dato etiqueta="Patente camión" [valor]="h.patenteCamion" />
          <nt-dato etiqueta="Patente remolque" [valor]="h.patenteRemolque" />
          @if (h.cliente) {
            <nt-dato etiqueta="Cliente" [valor]="h.cliente" class="nt-ancho-2" />
            <nt-dato etiqueta="Tramo" [valor]="h.tramo" class="nt-ancho-2" />
          }
        </div>
        <div class="documentos">
          @if (h.ordenRetiroId) {
            <a [routerLink]="['/operacion/ordenes-retiro', h.ordenRetiroId]"
              >Orden de retiro N° {{ h.ordenRetiroNumero | correlativo }}</a
            >
          }
          @if (h.ordenCargaId) {
            <a [routerLink]="['/operacion/ordenes-carga', h.ordenCargaId]"
              >Orden de carga N° {{ h.ordenCargaNumero | correlativo }}</a
            >
          }
          @if (h.rendicionId) {
            <a
              [routerLink]="[
                h.tipo === 'ESTADIA' ? '/operacion/estadias' : '/operacion/rendiciones',
                h.rendicionId,
              ]"
              >{{ h.tipo === 'ESTADIA' ? 'Estadía' : 'Rendición' }} N°
              {{ h.rendicionNumero | correlativo }}</a
            >
          } @else {
            <span class="nt-tenue">Sin rendición</span>
            @if (puedeRendir()) {
              <p-button
                label="Crear rendición"
                icon="pi pi-receipt"
                size="small"
                [outlined]="true"
                routerLink="/operacion/rendiciones/nuevo"
                [queryParams]="{ carga: h.ordenCargaId }"
              />
            }
          }
        </div>
      </section>

      @if (h.ordenCarga; as oc) {
        <section class="nt-tarjeta">
          <div class="nt-tarjeta-titulo">
            <h2>Guías del flete</h2>
            <strong>{{ oc.totalNeto | pesos }}</strong>
          </div>
          <div class="tabla-lineas">
            <table>
              <thead>
                <tr>
                  <th>N° guía</th>
                  <th>Fecha</th>
                  <th>Especie</th>
                  <th>N° contenedor</th>
                  <th>Tramo/Tarifa</th>
                  <th class="num">Cantidad</th>
                  <th class="num">Valor unitario</th>
                  <th class="num">Total</th>
                </tr>
              </thead>
              <tbody>
                @for (g of oc.guias; track g.id) {
                  <tr>
                    <td>{{ g.numeroGuia }}</td>
                    <td>{{ g.fechaGuia | fecha }}</td>
                    <td>{{ g.especie }}</td>
                    <td>{{ g.numeroContenedor }}</td>
                    <td>{{ g.tramoTexto }}</td>
                    <td class="num">{{ g.cantidadTarifa | numero: 1 }}</td>
                    <td class="num">{{ g.valorUnitario | pesos }}</td>
                    <td class="num">{{ g.total | pesos }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
        <nt-resumen-retiro [retiro]="oc.retiro" />
      }

      @if (h.rendicion; as r) {
        <section class="nt-tarjeta">
          <div class="nt-tarjeta-titulo">
            <h2>{{ h.tipo === 'ESTADIA' ? 'Estadía' : 'Viaje' }}</h2>
          </div>
          @if (salidaGps(); as salida) {
            <nt-recorrido-gps
              [(visible)]="mostrarRecorrido"
              [patente]="h.patenteCamion"
              [salida]="salida"
              [llegada]="llegadaGps()"
              [kmRendidos]="r.kmRecorridos"
            />
          }
          <div class="nt-grilla">
            <nt-dato
              [etiqueta]="h.tipo === 'ESTADIA' ? 'Inicio' : 'Salida'"
              [valor]="(r.fechaSalida | fecha) + (r.horaSalida ? ' ' + r.horaSalida : '')"
            />
            <nt-dato
              [etiqueta]="h.tipo === 'ESTADIA' ? 'Término' : 'Llegada'"
              [valor]="(r.fechaLlegada | fecha) + (r.horaLlegada ? ' ' + r.horaLlegada : '')"
            />
            <nt-dato etiqueta="Odómetros" [valor]="rango(r.odometroInicial, r.odometroFinal)" />
            <nt-dato etiqueta="Kilómetros" [valor]="r.kmRecorridos | numero" />
            <nt-dato etiqueta="Horómetros" [valor]="rango(r.horometroInicial, r.horometroFinal)" />
            <nt-dato etiqueta="Total horas" [valor]="r.horasMotor | numero: 1" />
            <nt-dato etiqueta="Motor del remolque" [valor]="motor()" />
            <nt-dato etiqueta="Sitio de entrega" [valor]="r.sitioEntrega" />
          </div>
        </section>

        <section class="nt-tarjeta">
          <div class="nt-tarjeta-titulo"><h2>Gastos</h2></div>
          <div class="nt-grilla">
            <nt-dato etiqueta="Peajes" [valor]="r.peajes | pesos" />
            <nt-dato etiqueta="Carga y descarga" [valor]="r.carga + r.descarga | pesos" />
            <nt-dato etiqueta="Viáticos" [valor]="r.totalViaticos | pesos" />
            <nt-dato etiqueta="Varios (otros gastos)" [valor]="r.totalOtrosGastos | pesos" />
            <nt-dato etiqueta="Petróleo" [valor]="r.petroleo | pesos" />
          </div>
          @if (r.gastos.length) {
            <div class="tabla-lineas">
              <table>
                <thead>
                  <tr>
                    <th>Tipo documento</th>
                    <th>N° documento</th>
                    <th>Fecha</th>
                    <th>Ítem</th>
                    <th>Observaciones</th>
                    <th class="num">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  @for (g of r.gastos; track g.id) {
                    <tr>
                      <td>{{ g.tipoDocumento }}</td>
                      <td>{{ g.numeroDocumento }}</td>
                      <td>{{ g.fecha | fecha }}</td>
                      <td>{{ g.itemGasto }}</td>
                      <td>{{ g.observaciones }}</td>
                      <td class="num">{{ g.monto | pesos }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
          <div class="nt-totales">
            <div class="total principal">
              <span>Gastos total</span><strong>{{ r.totalGeneral | pesos }}</strong>
            </div>
          </div>
        </section>
      }
    }
  `,
  styles: `
    .documentos {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 1.25rem;
      margin-top: 1rem;
      font-size: 0.88rem;
      a {
        text-decoration: none;
        color: var(--p-primary-color);
      }
    }
    .tabla-lineas {
      overflow-x: auto;
      margin-top: 1rem;
    }
    .tabla-lineas table {
      border-collapse: collapse;
      min-width: 100%;
      font-size: 0.88rem;
    }
    .tabla-lineas th {
      text-align: left;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--p-text-muted-color);
      font-weight: 600;
      padding: 0 0.5rem 0.5rem;
      white-space: nowrap;
    }
    .tabla-lineas td {
      padding: 0.45rem 0.5rem;
      border-top: 1px solid var(--p-content-border-color);
    }
    .tabla-lineas .num {
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class HojaRuta {
  private readonly api = inject(ApiService);
  private readonly sesion = inject(SesionService);

  /** «C<id de la orden de carga>» o «E<id de la estadía>». */
  readonly id = input.required<string>();
  readonly h = signal<HojaRutaDetalleDto | null>(null);
  readonly mostrarRecorrido = signal(false);

  readonly tipo = computed(() => {
    const h = this.h();
    return h ? TIPO_RENDICION_ETIQUETA[h.tipo] : '';
  });
  readonly subtitulo = computed(() => {
    const h = this.h();
    return h ? `${h.conductor} · ${h.origen} → ${h.destino}` : '';
  });
  readonly puedeRendir = computed(
    () => this.h()?.estado === 'ABIERTA' && this.sesion.puede('editarFinanzas'),
  );
  readonly motor = computed(() => {
    const con = this.h()?.rendicion?.remolqueConMotor;
    return con === null || con === undefined ? null : con ? 'Con motor' : 'Sin motor';
  });
  readonly salidaGps = computed(() => {
    const r = this.h()?.rendicion;
    return r?.fechaSalida ? `${r.fechaSalida}T${r.horaSalida ?? '00:00'}` : null;
  });
  readonly llegadaGps = computed(() => {
    const r = this.h()?.rendicion;
    return r?.fechaLlegada ? `${r.fechaLlegada}T${r.horaLlegada ?? '23:59'}` : null;
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.cargar(id));
    });
  }

  private async cargar(id: string): Promise<void> {
    this.h.set(null);
    this.h.set(await this.api.get<HojaRutaDetalleDto>(`hojas-ruta/${id}`));
  }

  rango(inicial: number | null, final: number | null): string {
    const f = (n: number | null) => (n === null ? '—' : n.toLocaleString('es-CL'));
    return inicial === null && final === null ? '' : `${f(inicial)} → ${f(final)}`;
  }
}
