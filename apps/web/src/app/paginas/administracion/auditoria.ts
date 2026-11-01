import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import {
  ESTADO_ETIQUETA,
  formatearFecha,
  formatearPesos,
  type AuditoriaDto,
  type Estado,
} from '@nexustrack/shared';
import { ApiService } from '../../nucleo/api.service';
import { FiltroFechas, type RangoFechas } from '../../compartido/documentos/filtro-fechas';
import { TablaDatos, type ColumnaTabla } from '../../compartido/tabla/tabla-datos';

const ENTIDADES: Record<string, string> = {
  OrdenRetiro: 'Orden de retiro',
  OrdenCarga: 'Orden de carga',
  ValeDinero: 'Vale de dinero',
  ValeCombustible: 'Vale de combustible',
  Rendicion: 'Rendición',
  Empresa: 'Empresa',
  Cliente: 'Cliente',
  Packing: 'Packing',
  Movil: 'Móvil',
  Conductor: 'Conductor',
  Asignacion: 'Asignación',
  RutaTarifa: 'Ruta tarifa',
  CatalogoItem: 'Catálogo',
  Usuario: 'Usuario',
  Parametro: 'Parámetro',
};

const ACCIONES: Record<string, string> = {
  CREAR: 'Creó',
  EDITAR: 'Modificó',
  ANULAR: 'Anuló',
  ELIMINAR: 'Eliminó',
  ASIGNAR: 'Asignó',
};

/** Pantalla donde se abre cada documento, para ir desde la auditoría. */
const RUTAS: Record<string, string> = {
  OrdenRetiro: '/operacion/ordenes-retiro',
  OrdenCarga: '/operacion/ordenes-carga',
  ValeDinero: '/operacion/vales-dinero',
  ValeCombustible: '/operacion/vales-combustible',
  Rendicion: '/operacion/rendiciones',
};

/** Nombres de campo que no salen bien solo separando las palabras. */
const CAMPOS: Record<string, string> = {
  numero: 'N°',
  anio: 'Año',
  rut: 'RUT',
  razonSocial: 'Razón social',
  telefono: 'Teléfono',
  direccion: 'Dirección',
  comision: 'Comisión',
  numeroMotor: 'N° motor',
  numeroChasis: 'N° chasis',
  numeroGuia: 'N° guía',
  numeroContenedor: 'N° contenedor',
  numeroDocumento: 'N° documento',
  numeroCuenta: 'N° cuenta',
  numeroLicencia: 'N° licencia',
  numeroSerie: 'N° serie',
  vencLicencia: 'Vencimiento licencia',
  vencRevisionTecnica: 'Vencimiento revisión técnica',
  vencPermisoCirculacion: 'Vencimiento permiso de circulación',
  vencSeguro: 'Vencimiento seguro',
  terminoContrato: 'Término de contrato',
  kmRecorridos: 'Km recorridos',
  odometroInicial: 'Odómetro inicial',
  odometroFinal: 'Odómetro final',
  totalViaticos: 'Total viáticos',
  viaticos: 'Viáticos',
  guias: 'Guías',
  tramoTexto: 'Tramo',
  hojaRuta: 'Hoja de ruta',
  motivo: 'Motivo',
  motivoAnulacion: 'Motivo de anulación',
  anuladoEn: 'Anulado el',
  linea: 'Línea',
  camion: 'Camión',
  rol: 'Perfil',
  email: 'Correo',
};

/** Campos en pesos: se muestran con signo $. */
const PESOS = new Set([
  'monto',
  'total',
  'totalNeto',
  'totalGeneral',
  'totalViaticos',
  'totalOtrosGastos',
  'valor',
  'valorUnitario',
  'valorLitro',
  'peajes',
  'carga',
  'descarga',
  'desayuno',
  'almuerzo',
  'comida',
]);

export function etiquetaCampo(campo: string): string {
  if (CAMPOS[campo]) return CAMPOS[campo];
  const id = campo.endsWith('Id') && campo.length > 2;
  const palabras = (id ? campo.slice(0, -2) : campo).replace(/([A-Z])/g, ' $1').toLowerCase();
  const texto = palabras.charAt(0).toUpperCase() + palabras.slice(1);
  return id ? `${texto} (id)` : texto;
}

export function valorLegible(campo: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'number') {
    if (campo === 'numero' || campo === 'hojaRuta') return String(v).padStart(6, '0');
    if (PESOS.has(campo)) return formatearPesos(v);
    return v.toLocaleString('es-CL');
  }
  if (typeof v === 'string') {
    if (campo === 'estado') return ESTADO_ETIQUETA[v as Estado] ?? v;
    if (/^\d{4}-\d{2}-\d{2}(T00:00:00(\.000)?Z)?$/.test(v)) return formatearFecha(v.slice(0, 10));
    if (/^\d{4}-\d{2}-\d{2}T/.test(v))
      return new Date(v).toLocaleString('es-CL', { timeZone: 'America/Santiago' });
    return v;
  }
  if (Array.isArray(v)) return `${v.length} ${v.length === 1 ? 'línea' : 'líneas'}`;
  return Object.entries(v as Record<string, unknown>)
    .map(([k, x]) => `${etiquetaCampo(k)}: ${valorLegible(k, x)}`)
    .join(' · ');
}

interface FilaDetalle {
  campo: string;
  antes?: string;
  despues?: string;
  valor?: string;
}

interface Lineas {
  titulo: string;
  columnas: string[];
  filas: string[][];
}

interface Detalle {
  /** Cambios campo a campo (editar) o copia de los datos (crear, eliminar, anular). */
  modo: 'cambios' | 'copia';
  filas: FilaDetalle[];
  lineas: Lineas[];
}

const esCambio = (v: unknown): v is { antes: unknown; despues: unknown } =>
  !!v && typeof v === 'object' && !Array.isArray(v) && 'antes' in v && 'despues' in v;

export function detalleDe(cambios: unknown): Detalle {
  const c = cambios && typeof cambios === 'object' ? (cambios as Record<string, unknown>) : {};
  const entradas = Object.entries(c);
  if (entradas.length && entradas.every(([, v]) => esCambio(v))) {
    return {
      modo: 'cambios',
      lineas: [],
      filas: entradas.map(([campo, v]) => {
        const cambio = v as { antes: unknown; despues: unknown };
        return {
          campo: etiquetaCampo(campo),
          antes: valorLegible(campo, cambio.antes),
          despues: valorLegible(campo, cambio.despues),
        };
      }),
    };
  }
  const lineas: Lineas[] = [];
  const filas: FilaDetalle[] = [];
  for (const [campo, v] of entradas) {
    if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
      const claves = Object.keys(v[0] as object).filter((k) => k !== 'id' && !k.endsWith('Id'));
      lineas.push({
        titulo: etiquetaCampo(campo),
        columnas: claves.map(etiquetaCampo),
        filas: (v as Record<string, unknown>[]).map((fila) =>
          claves.map((k) => valorLegible(k, fila[k])),
        ),
      });
    } else if (campo !== 'id' && !campo.endsWith('Id') && v !== null && v !== '') {
      // Los ids internos y los campos vacíos no aportan en la copia; el N° va primero.
      const fila = { campo: etiquetaCampo(campo), valor: valorLegible(campo, v) };
      if (campo === 'numero') filas.unshift(fila);
      else filas.push(fila);
    }
  }
  return { modo: 'copia', filas, lineas };
}

function resumenDe(a: AuditoriaDto): string {
  const c =
    a.cambios && typeof a.cambios === 'object' ? (a.cambios as Record<string, unknown>) : {};
  switch (a.accion) {
    case 'ANULAR':
      return `Motivo: ${c['motivo'] ?? '—'}`;
    case 'ELIMINAR':
      return 'Eliminado; queda copia de todos sus datos';
    case 'CREAR':
      return 'Registro nuevo';
    case 'EDITAR':
      return Object.keys(c).map(etiquetaCampo).join(', ');
    default:
      return valorLegible('', c);
  }
}

type FilaAuditoria = AuditoriaDto & {
  entidadNombre: string;
  accionNombre: string;
  hora: string;
  registro: string;
  resumen: string;
};

@Component({
  selector: 'nt-auditoria',
  imports: [TablaDatos, FiltroFechas, Dialog, Button, RouterLink],
  template: `
    <div class="nt-encabezado">
      <div>
        <h1>Auditoría</h1>
        <p>
          Quién creó, modificó, anuló o eliminó cada registro y cuándo, con el detalle de los
          cambios. Haga clic en una fila para verlo.
        </p>
      </div>
      <div class="nt-encabezado-acciones">
        <nt-filtro-fechas (cambio)="filtrar($event)" />
      </div>
    </div>
    <nt-tabla
      [filas]="filas()"
      [columnas]="columnas"
      titulo="Auditoría"
      [subtitulo]="rango()?.descripcion ?? ''"
      [cargando]="cargando()"
      claveEstado="auditoria-v2"
      (seleccionar)="seleccion.set($event)"
    />

    <p-dialog
      [header]="seleccion() ? seleccion()!.accionNombre + ' · ' + seleccion()!.entidadNombre : ''"
      [visible]="!!seleccion()"
      (visibleChange)="!$event && seleccion.set(null)"
      [modal]="true"
      [dismissableMask]="true"
      [style]="{ width: '46rem', maxWidth: '96vw' }"
    >
      @if (seleccion(); as s) {
        <p class="quien">
          <strong>{{ s.usuario ?? 'Usuario eliminado' }}</strong> ·
          {{ s.fecha.split('-').reverse().join('/') }} {{ s.hora }} ·
          {{ s.referencia ?? '#' + s.entidadId }}
          @if (s.eliminado) {
            <span class="eliminado">eliminado</span>
          }
        </p>
        @if (detalle(); as d) {
          @if (d.modo === 'cambios') {
            <table class="detalle">
              <thead>
                <tr>
                  <th>Campo</th>
                  <th>Antes</th>
                  <th>Después</th>
                </tr>
              </thead>
              <tbody>
                @for (f of d.filas; track $index) {
                  <tr>
                    <td>{{ f.campo }}</td>
                    <td class="antes">{{ f.antes }}</td>
                    <td class="despues">{{ f.despues }}</td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <table class="detalle">
              <tbody>
                @for (f of d.filas; track $index) {
                  <tr>
                    <td>{{ f.campo }}</td>
                    <td>{{ f.valor }}</td>
                  </tr>
                }
              </tbody>
            </table>
            @for (l of d.lineas; track l.titulo) {
              <h3>{{ l.titulo }}</h3>
              <div class="desplazable">
                <table class="detalle lineas">
                  <thead>
                    <tr>
                      @for (c of l.columnas; track $index) {
                        <th>{{ c }}</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (fila of l.filas; track $index) {
                      <tr>
                        @for (v of fila; track $index) {
                          <td>{{ v }}</td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          }
        }
      }
      <ng-template #footer>
        @if (rutaRegistro(); as ruta) {
          <p-button
            label="Abrir registro"
            icon="pi pi-external-link"
            [text]="true"
            [routerLink]="ruta"
            (onClick)="seleccion.set(null)"
          />
        }
        <p-button label="Cerrar" severity="secondary" (onClick)="seleccion.set(null)" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .quien {
      margin-top: 0;
      color: var(--p-text-muted-color);
    }
    .eliminado {
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      padding: 0.1rem 0.45rem;
      border-radius: 999px;
      background: color-mix(in srgb, var(--nt-peligro) 14%, transparent);
      color: var(--nt-peligro);
    }
    h3 {
      font-size: 0.9rem;
      margin: 1.25rem 0 0.5rem;
    }
    .desplazable {
      overflow-x: auto;
    }
    .detalle {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      th {
        text-align: left;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: var(--p-text-muted-color);
        font-weight: 600;
        padding: 0.4rem 0.5rem;
        border-bottom: 1px solid var(--p-content-border-color);
      }
      td {
        padding: 0.4rem 0.5rem;
        border-bottom: 1px solid var(--p-content-border-color);
        vertical-align: top;
        word-break: break-word;
      }
      td:first-child {
        color: var(--p-text-muted-color);
        width: 34%;
      }
      .antes {
        text-decoration: line-through;
        color: var(--p-text-muted-color);
      }
      .despues {
        font-weight: 600;
      }
    }
    .detalle.lineas td,
    .detalle.lineas th {
      white-space: nowrap;
      width: auto;
      color: inherit;
    }
  `,
})
export class Auditoria {
  private readonly api = inject(ApiService);

  readonly filas = signal<FilaAuditoria[]>([]);
  readonly cargando = signal(true);
  readonly rango = signal<RangoFechas | null>(null);
  readonly seleccion = signal<FilaAuditoria | null>(null);

  readonly detalle = computed(() => {
    const s = this.seleccion();
    return s ? detalleDe(s.cambios) : null;
  });
  readonly rutaRegistro = computed(() => {
    const s = this.seleccion();
    return s && !s.eliminado && RUTAS[s.entidad] ? [RUTAS[s.entidad], s.entidadId] : null;
  });

  readonly columnas: ColumnaTabla[] = [
    { campo: 'fecha', titulo: 'Fecha', tipo: 'fecha' },
    { campo: 'hora', titulo: 'Hora', filtro: false },
    { campo: 'usuario', titulo: 'Usuario', filtro: 'lista' },
    { campo: 'accionNombre', titulo: 'Acción', filtro: 'lista' },
    { campo: 'entidadNombre', titulo: 'Registro', filtro: 'lista' },
    { campo: 'registro', titulo: 'Referencia', ancho: '14rem' },
    { campo: 'resumen', titulo: 'Detalle', ancho: '22rem' },
  ];

  async filtrar(rango: RangoFechas): Promise<void> {
    this.rango.set(rango);
    this.cargando.set(true);
    try {
      const lista = await this.api.get<AuditoriaDto[]>('auditoria', {
        desde: rango.desde,
        hasta: rango.hasta,
      });
      const hora = new Intl.DateTimeFormat('es-CL', {
        timeZone: 'America/Santiago',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
      const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' });
      this.filas.set(
        lista.map((a) => ({
          ...a,
          fecha: fecha.format(new Date(a.fecha)),
          hora: hora.format(new Date(a.fecha)),
          entidadNombre: ENTIDADES[a.entidad] ?? a.entidad,
          accionNombre: ACCIONES[a.accion] ?? a.accion,
          registro: `${a.referencia ?? `#${a.entidadId}`}${a.eliminado ? ' (eliminado)' : ''}`,
          resumen: resumenDe(a),
        })),
      );
    } finally {
      this.cargando.set(false);
    }
  }
}
