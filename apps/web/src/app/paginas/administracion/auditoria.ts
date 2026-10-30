import { JsonPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Dialog } from 'primeng/dialog';
import type { AuditoriaDto } from '@nexustrack/shared';
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

@Component({
  selector: 'nt-auditoria',
  imports: [TablaDatos, FiltroFechas, Dialog, JsonPipe],
  template: `
    <div class="nt-encabezado">
      <div>
        <h1>Auditoría</h1>
        <p>
          Registro de quién creó, modificó o anuló cada registro, con el detalle de los cambios.
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
      claveEstado="auditoria"
      (seleccionar)="detalle.set($event)"
    />

    <p-dialog
      [header]="
        'Cambios · ' + (detalle()?.entidadNombre ?? '') + ' #' + (detalle()?.entidadId ?? '')
      "
      [visible]="!!detalle()"
      (visibleChange)="!$event && detalle.set(null)"
      [modal]="true"
      [dismissableMask]="true"
      [style]="{ width: '40rem', maxWidth: '96vw' }"
    >
      <pre class="cambios">{{ detalle()?.cambios | json }}</pre>
    </p-dialog>
  `,
  styles: `
    .cambios {
      background: var(--p-content-hover-background);
      border-radius: 8px;
      padding: 1rem;
      font-size: 0.8rem;
      max-height: 60vh;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }
  `,
})
export class Auditoria {
  private readonly api = inject(ApiService);

  readonly filas = signal<
    (AuditoriaDto & { entidadNombre: string; hora: string; resumen: string })[]
  >([]);
  readonly cargando = signal(true);
  readonly rango = signal<RangoFechas | null>(null);
  readonly detalle = signal<(AuditoriaDto & { entidadNombre: string }) | null>(null);

  readonly columnas: ColumnaTabla[] = [
    { campo: 'fecha', titulo: 'Fecha', tipo: 'fecha' },
    { campo: 'hora', titulo: 'Hora', filtro: false },
    { campo: 'usuario', titulo: 'Usuario', filtro: 'lista' },
    { campo: 'entidadNombre', titulo: 'Registro', filtro: 'lista' },
    { campo: 'entidadId', titulo: 'Id', tipo: 'numero' },
    { campo: 'accion', titulo: 'Acción', filtro: 'lista' },
    { campo: 'resumen', titulo: 'Campos', ancho: '20rem' },
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
          resumen:
            a.cambios && typeof a.cambios === 'object'
              ? Object.keys(a.cambios as object).join(', ')
              : '',
        })),
      );
    } finally {
      this.cargando.set(false);
    }
  }
}
