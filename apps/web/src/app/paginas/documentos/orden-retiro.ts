import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { type FormGroup } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import {
  ESTADOS_RETIRO_ACTIVOS,
  GRUPOS_MOVIL,
  hoyIso,
  TIPOS_REMOLQUE,
  type OrdenRetiroDto,
  type SugerenciaAsignacionDto,
  type ValeCombustibleDto,
  type ValeDineroDto,
} from '@nexustrack/shared';
import { ApiService } from '../../nucleo/api.service';
import { DatosMaestrosService } from '../../nucleo/datos-maestros.service';
import { CorrelativoPipe, FechaPipe, NumeroPipe, PesosPipe } from '../../nucleo/pipes';
import { SesionService } from '../../nucleo/sesion.service';
import { Cargando } from '../../compartido/cargando';
import { BarraDocumento } from '../../compartido/documentos/barra-documento';
import { EstadoTag } from '../../compartido/estado-tag';
import { CamposFormulario } from '../../compartido/formulario/campos-formulario';
import {
  aEntrada,
  construirFormulario,
  type CampoFormulario,
} from '../../compartido/formulario/formulario';

interface Seccion {
  titulo: string;
  campos: CampoFormulario[];
}

@Component({
  selector: 'nt-orden-retiro',
  imports: [
    BarraDocumento,
    Cargando,
    CamposFormulario,
    Message,
    Button,
    RouterLink,
    EstadoTag,
    CorrelativoPipe,
    FechaPipe,
    PesosPipe,
    NumeroPipe,
  ],
  templateUrl: './orden-retiro.html',
})
export class OrdenRetiro {
  private readonly api = inject(ApiService);
  private readonly maestros = inject(DatosMaestrosService);
  private readonly sesion = inject(SesionService);
  private readonly mensajes = inject(MessageService);
  private readonly router = inject(Router);

  /** Parámetro de ruta (ausente al crear). */
  readonly id = input<string>();

  readonly dto = signal<OrdenRetiroDto | null>(null);
  readonly form = signal<FormGroup | null>(null);
  readonly guardando = signal(false);
  readonly sugerencia = signal<string | null>(null);
  readonly valesDinero = signal<ValeDineroDto[]>([]);
  readonly valesCombustible = signal<ValeCombustibleDto[]>([]);
  /** Totales de los vales del flete; los anulados no cuentan. */
  readonly totalValesDinero = computed(() =>
    this.valesDinero()
      .filter((v) => v.estado !== 'ANULADO')
      .reduce((s, v) => s + v.monto, 0),
  );
  readonly totalValesCombustible = computed(() =>
    this.valesCombustible()
      .filter((v) => v.estado !== 'ANULADO')
      .reduce((s, v) => s + v.total, 0),
  );

  /** El administrador puede corregir además una orden cerrada. */
  readonly corrigiendo = computed(
    () => this.dto()?.estado === 'CERRADA' && this.sesion.puede('editarCerrados'),
  );
  readonly editable = computed(() => {
    const d = this.dto();
    return (
      this.sesion.puede('editarOperacion') &&
      (!d || ESTADOS_RETIRO_ACTIVOS.includes(d.estado) || this.corrigiendo())
    );
  });
  readonly activa = computed(
    () => !!this.dto() && ESTADOS_RETIRO_ACTIVOS.includes(this.dto()!.estado),
  );
  readonly puedeOperacion = computed(() => this.sesion.puede('editarOperacion'));
  readonly puedeFinanzas = computed(() => this.sesion.puede('editarFinanzas'));
  readonly subtitulo = computed(() => {
    const d = this.dto();
    if (d) return `${d.cliente} · ${d.origen} → ${d.destino} · ${d.conductor}`;
    return this.id() ? '' : 'Complete los datos del flete. El número se asigna al emitir.';
  });

  private readonly m = this.maestros;
  readonly secciones: Seccion[] = [
    {
      titulo: 'Flete',
      campos: [
        { campo: 'fecha', etiqueta: 'Fecha de orden de retiro', tipo: 'fecha', requerido: true },
        {
          campo: 'trazabilidadId',
          etiqueta: 'Trazabilidad',
          tipo: 'select',
          requerido: true,
          opciones: (v) => this.m.opcionesCatalogo('TRAZABILIDAD', v['trazabilidadId']),
        },
        {
          campo: 'clienteId',
          etiqueta: 'Cliente',
          tipo: 'select',
          requerido: true,
          ancho: 2,
          opciones: () => this.m.opcionesClientes().filter((o) => !o.inactivo),
        },
        {
          campo: 'origenId',
          etiqueta: 'Origen',
          tipo: 'select',
          requerido: true,
          opciones: (v) => this.m.opcionesCatalogo('CIUDAD', v['origenId']),
        },
        {
          campo: 'destinoId',
          etiqueta: 'Destino',
          tipo: 'select',
          requerido: true,
          opciones: (v) => this.m.opcionesCatalogo('CIUDAD', v['destinoId']),
        },
        {
          campo: 'destinoFinal',
          etiqueta: 'Destino final',
          tipo: 'texto',
          ancho: 2,
          mayusculas: true,
          max: 150,
          ayuda: 'Texto libre: terminal, consignatario u otro destino informado.',
        },
      ],
    },
    {
      titulo: 'Transporte',
      campos: [
        {
          campo: 'conductorId',
          etiqueta: 'Conductor',
          tipo: 'select',
          requerido: true,
          ancho: 2,
          opciones: () => this.m.opcionesConductores().filter((o) => !o.inactivo),
        },
        {
          campo: 'empresaId',
          etiqueta: 'Empresa',
          tipo: 'select',
          requerido: true,
          ancho: 2,
          opciones: () => this.m.opcionesEmpresas().filter((o) => !o.inactivo),
        },
        {
          campo: 'camionId',
          etiqueta: 'Patente camión',
          tipo: 'select',
          requerido: true,
          opciones: () => this.m.opcionesMoviles(GRUPOS_MOVIL.camion).filter((o) => !o.inactivo),
        },
        {
          campo: 'remolqueId',
          etiqueta: 'Patente remolque',
          tipo: 'select',
          opciones: () => this.m.opcionesMoviles(TIPOS_REMOLQUE).filter((o) => !o.inactivo),
        },
        {
          campo: 'tipoRemolque',
          etiqueta: 'Tipo remolque',
          tipo: 'calculado',
          calcular: (v) => this.m.moviles().find((x) => x.id === v['remolqueId'])?.tipo ?? '',
        },
      ],
    },
    {
      titulo: 'Retiro y carga',
      campos: [
        {
          campo: 'depositoRetiroId',
          etiqueta: 'Depósito de retiro',
          tipo: 'select',
          ancho: 2,
          opciones: (v) => this.m.opcionesCatalogo('DEPOSITO', v['depositoRetiroId']),
        },
        {
          campo: 'packingCargaId',
          etiqueta: 'Packing de carga',
          tipo: 'select',
          ancho: 2,
          opciones: (v) => this.m.opcionesPackings(v['clienteId']),
          ayuda: 'Packings del cliente seleccionado.',
        },
        { campo: 'fechaCarga', etiqueta: 'Fecha de carga', tipo: 'fecha' },
        { campo: 'horaCarga', etiqueta: 'Hora de carga', tipo: 'hora' },
        {
          campo: 'depositoEntregaId',
          etiqueta: 'Depósito de entrega',
          tipo: 'select',
          opciones: (v) => this.m.opcionesCatalogo('DEPOSITO', v['depositoEntregaId']),
        },
        {
          campo: 'packingEntregaId',
          etiqueta: 'Packing de entrega',
          tipo: 'select',
          opciones: () => this.m.opcionesPackings(),
        },
      ],
    },
    {
      titulo: 'Embarque',
      campos: [
        { campo: 'nave', etiqueta: 'Nave', tipo: 'texto', mayusculas: true, max: 100 },
        { campo: 'mtb', etiqueta: 'MTB', tipo: 'texto', mayusculas: true, max: 60 },
        { campo: 'booking', etiqueta: 'Booking', tipo: 'texto', mayusculas: true, max: 60 },
        {
          campo: 'puertoEmbarqueId',
          etiqueta: 'Puerto de embarque',
          tipo: 'select',
          opciones: (v) => this.m.opcionesCatalogo('PUERTO_EMBARQUE', v['puertoEmbarqueId']),
        },
        { campo: 'fechaEmbarque', etiqueta: 'Fecha de embarque', tipo: 'fecha' },
        { campo: 'horaEmbarque', etiqueta: 'Hora de embarque', tipo: 'hora' },
        { campo: 'opNumero', etiqueta: 'OP N°', tipo: 'texto', mayusculas: true, max: 40 },
        { campo: 'ordenCompra', etiqueta: 'O/C', tipo: 'texto', mayusculas: true, max: 40 },
        {
          campo: 'observaciones',
          etiqueta: 'Observaciones',
          tipo: 'textarea',
          ancho: 4,
          max: 1000,
        },
      ],
    },
  ];
  private readonly campos = this.secciones.flatMap((s) => s.campos);

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.cargar(id));
    });
  }

  private async cargar(id: string | undefined): Promise<void> {
    await this.maestros.asegurar(
      'catalogos',
      'clientes',
      'empresas',
      'conductores',
      'moviles',
      'packings',
    );
    const d = id ? await this.api.get<OrdenRetiroDto>(`ordenes-retiro/${id}`) : null;
    this.dto.set(d);
    this.construir();
    if (d) {
      const [vd, vc] = await Promise.all([
        this.api.get<ValeDineroDto[]>('vales-dinero', { ordenRetiroId: d.id }),
        this.api.get<ValeCombustibleDto[]>('vales-combustible', { ordenRetiroId: d.id }),
      ]);
      this.valesDinero.set(vd);
      this.valesCombustible.set(vc);
    }
  }

  private construir(): void {
    const d = this.dto();
    const form = construirFormulario(this.campos, d ?? { fecha: hoyIso() }, !!d);
    if (!this.editable()) form.disable();
    form
      .get('conductorId')!
      .valueChanges.subscribe((id: number | null) => void this.sugerirPorConductor(id));
    form
      .get('camionId')!
      .valueChanges.subscribe((id: number | null) => void this.sugerirPorCamion(id));
    // La trazabilidad decide el remolque: PLANTA-PUERTO lleva thermo; los contenedores, chasis.
    form
      .get('trazabilidadId')!
      .valueChanges.subscribe(() => void this.sugerirPorCamion(form.get('camionId')!.value, true));
    form.get('clienteId')!.valueChanges.subscribe((clienteId: number | null) => {
      const packing = this.maestros
        .packings()
        .find((p) => p.id === form.get('packingCargaId')!.value);
      if (packing && packing.clienteId !== clienteId) form.get('packingCargaId')!.setValue(null);
    });
    this.sugerencia.set(null);
    this.form.set(form);
  }

  /** Autocompletado: empresa, camión y remolque desde la asignación vigente del conductor. */
  private async sugerirPorConductor(conductorId: number | null): Promise<void> {
    const form = this.form();
    if (!form || !conductorId) return;
    const s = await this.api.get<SugerenciaAsignacionDto>('asignaciones/sugerencia', {
      conductorId,
      trazabilidadId: form.get('trazabilidadId')!.value,
    });
    form.patchValue(
      {
        empresaId: s.empresaId ?? form.value.empresaId,
        camionId: s.camionId ?? form.value.camionId,
        remolqueId: s.remolqueId,
      },
      { emitEvent: false },
    );
    this.sugerencia.set(
      s.camionId
        ? [
            'Camión, remolque y empresa completados desde la asignación vigente del conductor.',
            this.avisoRemolque(s),
            'Puede modificarlos.',
          ]
            .filter(Boolean)
            .join(' ')
        : 'El conductor no tiene asignación vigente: complete camión y remolque.',
    );
  }

  /** Con [porTrazabilidad], un camión sin remolques asignados conserva el remolque elegido. */
  private async sugerirPorCamion(camionId: number | null, porTrazabilidad = false): Promise<void> {
    const form = this.form();
    if (!form || !camionId) return;
    const s = await this.api.get<SugerenciaAsignacionDto>('asignaciones/sugerencia', {
      camionId,
      trazabilidadId: form.get('trazabilidadId')!.value,
    });
    if (porTrazabilidad && !s.remolques.length) return;
    form.patchValue({ remolqueId: s.remolqueId }, { emitEvent: false });
    this.sugerencia.set(
      s.remolques.length
        ? ['Remolque según la asignación vigente del camión.', this.avisoRemolque(s)]
            .filter(Boolean)
            .join(' ')
        : 'El camión no tiene remolque asignado.',
    );
  }

  /** Qué remolque se eligió y por qué, o qué falta asignar. */
  private avisoRemolque(s: SugerenciaAsignacionDto): string {
    const pedido = s.remolquePedido;
    if (!pedido) {
      return s.remolques.length > 1 ? `Tiene ${s.remolques.length} remolques asignados.` : '';
    }
    return s.remolqueId
      ? `La trazabilidad lleva ${pedido}: se eligió el ${pedido} asignado.`
      : `La trazabilidad lleva ${pedido} y el camión no tiene uno asignado: elija el remolque.`;
  }

  async guardar(): Promise<void> {
    const form = this.form();
    if (!form) return;
    if (form.invalid) {
      form.markAllAsTouched();
      this.mensajes.add({
        severity: 'warn',
        summary: 'Revise los datos',
        detail: 'Hay campos obligatorios sin completar.',
      });
      return;
    }
    this.guardando.set(true);
    try {
      const entrada = aEntrada(this.campos, form);
      const d = this.dto();
      const r = d
        ? await this.api.put<OrdenRetiroDto>(`ordenes-retiro/${d.id}`, entrada)
        : await this.api.post<OrdenRetiroDto>('ordenes-retiro', entrada);
      this.mensajes.add({
        severity: 'success',
        summary: d ? 'Cambios guardados' : 'Orden de retiro emitida',
        detail: `N° ${String(r.numero).padStart(6, '0')}`,
      });
      if (d) {
        this.dto.set(r);
        this.construir();
      } else {
        await this.router.navigate(['/operacion/ordenes-retiro', r.id], { replaceUrl: true });
      }
    } finally {
      this.guardando.set(false);
    }
  }

  /** Solo administradores (ver BarraDocumento). */
  readonly eliminarDocumento = async (): Promise<void> => {
    const d = this.dto();
    if (!d) return;
    await this.api.eliminar(`ordenes-retiro/${d.id}`);
    this.mensajes.add({
      severity: 'success',
      summary: 'Orden de retiro eliminada',
      detail: `N° ${String(d.numero).padStart(6, '0')}`,
    });
    await this.router.navigate(['/operacion/ordenes-retiro'], { replaceUrl: true });
  };

  async anular(motivo: string): Promise<void> {
    const d = this.dto();
    if (!d) return;
    this.dto.set(await this.api.post<OrdenRetiroDto>(`ordenes-retiro/${d.id}/anular`, { motivo }));
    this.construir();
    this.mensajes.add({
      severity: 'success',
      summary: 'Orden anulada',
      detail: `N° ${String(d.numero).padStart(6, '0')}`,
    });
  }
}
