import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tooltip } from 'primeng/tooltip';
import {
  GRUPOS_MOVIL,
  hoyIso,
  type AsignacionDto,
  type TableroAsignacionDto,
} from '@nexustrack/shared';
import { ApiService } from '../../../nucleo/api.service';
import { DatosMaestrosService, type Opcion } from '../../../nucleo/datos-maestros.service';
import { dateAIso, isoADate } from '../../../nucleo/fechas';
import { FechaPipe } from '../../../nucleo/pipes';
import { SesionService } from '../../../nucleo/sesion.service';
import { CampoFecha } from '../../../compartido/formulario/campo-fecha';
import { TablaDatos, type ColumnaTabla } from '../../../compartido/tabla/tabla-datos';

interface FilaTablero {
  id: number;
  camionId: number;
  camion: string;
  camionTipo: string;
  empresa: string;
  empresaId: number;
  conductor: string | null;
  chasis: string | null;
  thermo: string | null;
  plataforma: string | null;
  desde: string | null;
  asignacion: AsignacionDto | null;
}

type Casilla = 'chasisId' | 'thermoId' | 'plataformaId';

@Component({
  selector: 'nt-asignaciones',
  imports: [
    TablaDatos,
    FormsModule,
    Button,
    Dialog,
    Select,
    CampoFecha,
    Checkbox,
    TableModule,
    Tooltip,
    FechaPipe,
  ],
  templateUrl: './asignaciones.html',
})
export class Asignaciones implements OnInit {
  private readonly api = inject(ApiService);
  private readonly maestros = inject(DatosMaestrosService);
  private readonly sesion = inject(SesionService);
  private readonly mensajes = inject(MessageService);
  private readonly confirmacion = inject(ConfirmationService);

  readonly tablero = signal<TableroAsignacionDto[]>([]);
  readonly cargando = signal(true);
  readonly puedeEditar = computed(() => this.sesion.puede('editarMantenedores'));

  readonly filas = computed<FilaTablero[]>(() =>
    this.tablero().map((t) => ({
      id: t.camionId,
      camionId: t.camionId,
      camion: t.camion,
      camionTipo: t.camionTipo,
      empresa: t.empresa,
      empresaId: t.empresaId,
      conductor: t.asignacion?.conductor ?? null,
      chasis: t.asignacion?.chasis ?? null,
      thermo: t.asignacion?.thermo ?? null,
      plataforma: t.asignacion?.plataforma ?? null,
      desde: t.asignacion?.fechaAsignacion ?? null,
      asignacion: t.asignacion,
    })),
  );

  readonly columnas: ColumnaTabla[] = [
    { campo: 'camion', titulo: 'Camión', ancho: '7rem' },
    { campo: 'camionTipo', titulo: 'Tipo', filtro: 'lista' },
    { campo: 'empresa', titulo: 'Empresa', filtro: 'lista', ancho: '14rem' },
    { campo: 'conductor', titulo: 'Conductor', ancho: '14rem' },
    { campo: 'chasis', titulo: 'Chasis' },
    { campo: 'thermo', titulo: 'Thermo' },
    { campo: 'plataforma', titulo: 'Plataforma' },
    { campo: 'desde', titulo: 'Desde', tipo: 'fecha' },
  ];

  // Diálogo de edición
  readonly dialogo = signal(false);
  readonly guardando = signal(false);
  readonly seleccionado = signal<FilaTablero | null>(null);
  conductorId: number | null = null;
  chasisId: number | null = null;
  thermoId: number | null = null;
  plataformaId: number | null = null;
  fecha: Date | null = new Date();
  readonly todosLosConductores = signal(false);

  // Historial
  readonly dialogoHistorial = signal(false);
  readonly historial = signal<AsignacionDto[]>([]);

  /** Patente → camión que la tiene asignada, para advertir antes de guardar. */
  private readonly ocupados = computed(() => {
    const mapa = new Map<number, string>();
    for (const t of this.tablero()) {
      const a = t.asignacion;
      if (!a) continue;
      for (const id of [a.conductorId, a.chasisId, a.thermoId, a.plataformaId])
        if (id) mapa.set(id, t.camion);
    }
    return mapa;
  });

  readonly opcionesConductor = computed<Opcion[]>(() => {
    const s = this.seleccionado();
    return this.maestros
      .conductores()
      .filter((c) => c.activo && (this.todosLosConductores() || !s || c.empresaId === s.empresaId))
      .map((c) => this.marcarOcupado({ label: c.nombre, value: c.id, detalle: c.empresa }, s));
  });

  opcionesRemolque(casilla: Casilla): Opcion[] {
    const grupo =
      casilla === 'chasisId'
        ? GRUPOS_MOVIL.chasis
        : casilla === 'thermoId'
          ? GRUPOS_MOVIL.thermo
          : GRUPOS_MOVIL.plataforma;
    const s = this.seleccionado();
    return this.maestros
      .opcionesMoviles(grupo)
      .filter((o) => !o.inactivo)
      .map((o) => this.marcarOcupado(o, s));
  }

  private marcarOcupado(o: Opcion, s: FilaTablero | null): Opcion {
    const camion = this.ocupados().get(o.value);
    return camion && camion !== s?.camion ? { ...o, detalle: `en ${camion}` } : o;
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.cargar(), this.maestros.asegurar('conductores', 'moviles')]);
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.tablero.set(await this.api.get<TableroAsignacionDto[]>('asignaciones/tablero'));
    } finally {
      this.cargando.set(false);
    }
  }

  editar(fila: FilaTablero): void {
    const a = fila.asignacion;
    this.seleccionado.set(fila);
    this.conductorId = a?.conductorId ?? null;
    this.chasisId = a?.chasisId ?? null;
    this.thermoId = a?.thermoId ?? null;
    this.plataformaId = a?.plataformaId ?? null;
    this.fecha = isoADate(hoyIso());
    this.todosLosConductores.set(false);
    this.dialogo.set(true);
  }

  async guardar(): Promise<void> {
    const s = this.seleccionado();
    if (!s || !this.fecha) return;
    this.guardando.set(true);
    try {
      await this.api.post('asignaciones', {
        camionId: s.camionId,
        conductorId: this.conductorId,
        chasisId: this.chasisId,
        thermoId: this.thermoId,
        plataformaId: this.plataformaId,
        fechaAsignacion: dateAIso(this.fecha),
      });
      this.mensajes.add({
        severity: 'success',
        summary: 'Asignación actualizada',
        detail: `Camión ${s.camion}`,
      });
      this.dialogo.set(false);
      await this.cargar();
    } finally {
      this.guardando.set(false);
    }
  }

  liberar(fila: FilaTablero): void {
    this.confirmacion.confirm({
      header: 'Liberar camión',
      message: `¿Dejar el camión ${fila.camion} sin conductor ni remolques? La asignación actual queda en el historial.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Liberar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        await this.api.post(`asignaciones/camion/${fila.camionId}/liberar`, { fecha: hoyIso() });
        this.mensajes.add({ severity: 'success', summary: 'Camión liberado', detail: fila.camion });
        await this.cargar();
      },
    });
  }

  async verHistorial(fila: FilaTablero): Promise<void> {
    this.seleccionado.set(fila);
    this.historial.set(
      await this.api.get<AsignacionDto[]>('asignaciones', { camionId: fila.camionId }),
    );
    this.dialogoHistorial.set(true);
  }
}
