import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule, type FormGroup } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { SelectButton } from 'primeng/selectbutton';
import {
  hoyIso,
  ORIGEN_ESTADIA,
  sumarDias,
  type OrdenRetiroDto,
  type RendicionDto,
  type ResumenEstadiaDto,
  type ResumenRetiroDto,
  type ValeDineroDto,
} from '@nexustrack/shared';
import { CorrelativoPipe, FechaPipe } from '../../nucleo/pipes';
import type { ColumnaTabla } from '../../compartido/tabla/tabla-datos';
import { Dato } from '../../compartido/documentos/dato';
import { ApiService } from '../../nucleo/api.service';
import { DatosMaestrosService } from '../../nucleo/datos-maestros.service';
import { SesionService } from '../../nucleo/sesion.service';
import { Cargando } from '../../compartido/cargando';
import { BarraDocumento } from '../../compartido/documentos/barra-documento';
import { CuentaConductor } from '../../compartido/documentos/cuenta-conductor';
import { ResumenRetiro } from '../../compartido/documentos/resumen-retiro';
import { SelectorPadre } from '../../compartido/documentos/selector-padre';
import { CamposFormulario } from '../../compartido/formulario/campos-formulario';
import {
  aEntrada,
  construirFormulario,
  type CampoFormulario,
} from '../../compartido/formulario/formulario';
import { aResumen, COLUMNAS_RETIROS } from './comun';

@Component({
  selector: 'nt-vale-dinero',
  imports: [
    BarraDocumento,
    Cargando,
    CuentaConductor,
    ResumenRetiro,
    SelectorPadre,
    CamposFormulario,
    Message,
    SelectButton,
    FormsModule,
    RouterLink,
    Dato,
    CorrelativoPipe,
    FechaPipe,
  ],
  template: `
    @if (creando() && !retiro() && !estadia()) {
      <nt-barra-documento titulo="Nuevo vale de dinero" volver="/operacion/vales-dinero" />
      <p-selectbutton
        class="origen"
        [options]="origenes"
        [ngModel]="origen()"
        (ngModelChange)="elegirOrigen($event)"
        optionLabel="label"
        optionValue="value"
        [allowEmpty]="false"
        aria-label="Anticipo de un flete o de una estadía"
      />
      @if (origen() === 'retiro') {
        <nt-selector-padre
          titulo="Órdenes de retiro activas"
          instrucciones="Seleccione la orden de retiro a la que asignará el vale de dinero (anticipo de viaje)."
          [filas]="candidatos()"
          [columnas]="columnasRetiros"
          [cargando]="cargandoCandidatos()"
          (elegir)="elegirRetiro($event)"
        />
      } @else {
        <nt-selector-padre
          titulo="Estadías de los últimos 60 días"
          instrucciones="Seleccione la estadía a la que asignará el vale de dinero (anticipo)."
          [filas]="estadias()"
          [columnas]="columnasEstadias"
          [cargando]="cargandoCandidatos()"
          (elegir)="elegirEstadia($event)"
        />
      }
    } @else {
      <nt-barra-documento
        titulo="Vale de dinero"
        [subtitulo]="conductor() ? 'Anticipo de viaje · ' + conductor() : ''"
        [numero]="dto()?.numero ?? null"
        [estado]="dto()?.estado ?? null"
        [recurso]="'vales-dinero/' + dto()?.id"
        volver="/operacion/vales-dinero"
        [editable]="editable() && !!form()"
        [anulable]="dto()?.estado === 'EMITIDO'"
        [eliminable]="!!dto()"
        [eliminar]="eliminarDocumento"
        [guardando]="guardando()"
        (guardar)="guardar()"
        (anular)="anular($event)"
      />
      @if (!form()) {
        <nt-cargando class="bloque" />
      }
      @if (dto()?.estado === 'ANULADO') {
        <p-message severity="error" style="display: block; margin-bottom: 1rem"
          >Vale anulado. Motivo: {{ dto()?.motivoAnulacion }}</p-message
        >
      }
      @if (resumen(); as r) {
        <nt-resumen-retiro [retiro]="r" />
      }
      @if (resumenEstadia(); as e) {
        <section class="nt-tarjeta">
          <div class="nt-tarjeta-titulo">
            <h2>Estadía N° {{ e.numero | correlativo }}</h2>
            <a class="ver" [routerLink]="['/operacion/estadias', e.id]">Ver estadía</a>
          </div>
          <div class="nt-grilla">
            <nt-dato etiqueta="Hoja de ruta" [valor]="e.hojaRuta | correlativo" />
            <nt-dato etiqueta="Inicio" [valor]="e.fechaInicio | fecha" />
            <nt-dato etiqueta="Origen" [valor]="origenEstadia" />
            <nt-dato etiqueta="Lugar (destino)" [valor]="e.destino" />
            <nt-dato etiqueta="Conductor" [valor]="e.conductor" class="nt-ancho-2" />
            <nt-dato etiqueta="Empresa" [valor]="e.empresa" class="nt-ancho-2" />
            <nt-dato etiqueta="Patente camión" [valor]="e.camion" />
            <nt-dato etiqueta="Patente remolque" [valor]="e.remolque" />
          </div>
        </section>
      }
      @if (form(); as f) {
        <section class="nt-tarjeta">
          <div class="nt-tarjeta-titulo"><h2>Anticipo</h2></div>
          <nt-campos [form]="f" [campos]="campos" [soloLectura]="!editable()" />
        </section>
      }
      @if (conductorId(); as conductorId) {
        <nt-cuenta-conductor
          modo="anticipo"
          [conductorId]="conductorId"
          [clave]="clave()"
          [recargar]="dto()"
        />
      }
    }
  `,
  styles: `
    .origen {
      display: flex;
      margin-bottom: 1rem;
    }
    .ver {
      font-size: 0.85rem;
      text-decoration: none;
      color: var(--p-primary-color);
    }
  `,
})
export class ValeDinero {
  private readonly api = inject(ApiService);
  private readonly maestros = inject(DatosMaestrosService);
  private readonly sesion = inject(SesionService);
  private readonly mensajes = inject(MessageService);
  private readonly router = inject(Router);

  readonly id = input<string>();
  readonly retiro = input<string>();
  /** Parámetro de consulta: estadía a la que se entrega el anticipo. */
  readonly estadia = input<string>();

  readonly dto = signal<ValeDineroDto | null>(null);
  readonly resumen = signal<ResumenRetiroDto | null>(null);
  readonly resumenEstadia = signal<ResumenEstadiaDto | null>(null);
  readonly candidatos = signal<OrdenRetiroDto[]>([]);
  readonly estadias = signal<Record<string, unknown>[]>([]);
  readonly origen = signal<'retiro' | 'estadia'>('retiro');
  readonly origenes = [
    { label: 'Flete (orden de retiro)', value: 'retiro' },
    { label: 'Estadía', value: 'estadia' },
  ];
  readonly origenEstadia = ORIGEN_ESTADIA;
  readonly conductor = computed(
    () => this.resumen()?.conductor ?? this.resumenEstadia()?.conductor ?? '',
  );
  readonly conductorId = computed(
    () => this.resumen()?.conductorId ?? this.resumenEstadia()?.conductorId ?? null,
  );
  /** Flete o estadía del vale en la cuenta del conductor. */
  readonly clave = computed(() =>
    this.resumenEstadia() ? `E${this.resumenEstadia()!.id}` : `R${this.resumen()?.id ?? 0}`,
  );
  readonly columnasEstadias: ColumnaTabla[] = [
    { campo: 'numero', titulo: 'N°', tipo: 'correlativo', ancho: '6rem' },
    { campo: 'hojaRuta', titulo: 'Hoja de ruta', tipo: 'correlativo' },
    { campo: 'fechaSalida', titulo: 'Inicio', tipo: 'fecha' },
    { campo: 'conductor', titulo: 'Conductor', filtro: 'lista' },
    { campo: 'destino', titulo: 'Lugar', filtro: 'lista' },
    { campo: 'patenteCamion', titulo: 'Camión', filtro: 'lista' },
    { campo: 'totalGeneral', titulo: 'Total rendido', tipo: 'pesos' },
  ];
  readonly cargandoCandidatos = signal(false);
  readonly form = signal<FormGroup | null>(null);
  readonly guardando = signal(false);

  readonly columnasRetiros = COLUMNAS_RETIROS;
  readonly creando = computed(() => !this.id());
  readonly editable = computed(
    () => this.sesion.puede('editarFinanzas') && (!this.dto() || this.dto()!.estado === 'EMITIDO'),
  );

  readonly campos: CampoFormulario[] = [
    { campo: 'fechaEntrega', etiqueta: 'Fecha de entrega', tipo: 'fecha', requerido: true },
    { campo: 'concepto', etiqueta: 'Concepto', tipo: 'texto', mayusculas: true, max: 80 },
    {
      campo: 'sitioEntregaId',
      etiqueta: 'Sitio de entrega',
      tipo: 'select',
      requerido: true,
      opciones: (v) => this.maestros.opcionesCatalogo('SITIO_ENTREGA', v['sitioEntregaId']),
    },
    {
      campo: 'formaPagoId',
      etiqueta: 'Forma de pago',
      tipo: 'select',
      requerido: true,
      opciones: (v) => this.maestros.opcionesCatalogo('FORMA_PAGO', v['formaPagoId']),
    },
    { campo: 'monto', etiqueta: 'Monto entregado', tipo: 'pesos', requerido: true, min: 1 },
    { campo: 'glosa', etiqueta: 'Glosa', tipo: 'textarea', ancho: 3, max: 300 },
  ];

  constructor() {
    effect(() => {
      const id = this.id();
      const retiro = this.retiro();
      const estadia = this.estadia();
      untracked(() => void this.cargar(id, retiro, estadia));
    });
  }

  private async cargar(id?: string, retiroId?: string, estadiaId?: string): Promise<void> {
    await this.maestros.asegurar('catalogos', 'parametros');
    if (id) {
      const d = await this.api.get<ValeDineroDto>(`vales-dinero/${id}`);
      this.dto.set(d);
      this.resumen.set(d.retiro);
      this.resumenEstadia.set(d.estadia);
      this.construir();
    } else if (estadiaId) {
      const r = await this.api.get<RendicionDto>(`rendiciones/${estadiaId}`);
      this.resumenEstadia.set({
        id: r.id,
        numero: r.numero,
        hojaRuta: r.hojaRuta,
        estado: r.estado,
        fechaInicio: r.fechaSalida!,
        destino: r.destino,
        conductor: r.conductor,
        conductorId: r.conductorId,
        conductorRut: r.conductorRut,
        empresa: r.empresa,
        camion: r.patenteCamion,
        remolque: r.patenteRemolque,
      });
      this.construir();
    } else if (retiroId) {
      this.resumen.set(aResumen(await this.api.get<OrdenRetiroDto>(`ordenes-retiro/${retiroId}`)));
      this.construir();
    } else {
      this.cargandoCandidatos.set(true);
      try {
        this.candidatos.set(
          await this.api.get<OrdenRetiroDto[]>('ordenes-retiro', { activas: true }),
        );
      } finally {
        this.cargandoCandidatos.set(false);
      }
    }
  }

  elegirRetiro(id: number): void {
    void this.router.navigate([], { queryParams: { retiro: id } });
  }

  elegirEstadia(id: number): void {
    void this.router.navigate([], { queryParams: { estadia: id } });
  }

  async elegirOrigen(origen: 'retiro' | 'estadia'): Promise<void> {
    this.origen.set(origen);
    if (origen !== 'estadia' || this.estadias().length) return;
    this.cargandoCandidatos.set(true);
    try {
      const lista = await this.api.get<RendicionDto[]>('rendiciones', {
        tipo: 'ESTADIA',
        estado: 'EMITIDO',
        desde: sumarDias(hoyIso(), -60),
      });
      this.estadias.set(
        lista.map((r) => ({
          id: r.id,
          numero: r.numero,
          hojaRuta: r.hojaRuta,
          fechaSalida: r.fechaSalida,
          conductor: r.conductor,
          destino: r.destino,
          patenteCamion: r.patenteCamion,
          totalGeneral: r.totalGeneral,
        })),
      );
    } finally {
      this.cargandoCandidatos.set(false);
    }
  }

  private construir(): void {
    const d = this.dto();
    const form = construirFormulario(
      this.campos,
      d ?? {
        fechaEntrega: hoyIso(),
        concepto: this.maestros.parametro('CONCEPTO_VALE_DINERO') || 'FLETE',
      },
      !!d,
    );
    if (!this.editable()) form.disable();
    this.form.set(form);
  }

  async guardar(): Promise<void> {
    const form = this.form();
    const r = this.resumen();
    const e = this.resumenEstadia();
    if (!form || (!r && !e)) return;
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
      const entrada = {
        ...aEntrada(this.campos, form),
        ordenRetiroId: r?.id ?? null,
        estadiaId: e?.id ?? null,
      };
      const d = this.dto();
      const res = d
        ? await this.api.put<ValeDineroDto>(`vales-dinero/${d.id}`, entrada)
        : await this.api.post<ValeDineroDto>('vales-dinero', entrada);
      this.mensajes.add({
        severity: 'success',
        summary: d ? 'Cambios guardados' : 'Vale de dinero emitido',
        detail: `N° ${String(res.numero).padStart(6, '0')}`,
      });
      if (d) {
        this.dto.set(res);
        this.construir();
      } else {
        await this.router.navigate(['/operacion/vales-dinero', res.id], { replaceUrl: true });
      }
    } finally {
      this.guardando.set(false);
    }
  }

  /** Solo administradores (ver BarraDocumento). */
  readonly eliminarDocumento = async (): Promise<void> => {
    const d = this.dto();
    if (!d) return;
    await this.api.eliminar(`vales-dinero/${d.id}`);
    this.mensajes.add({
      severity: 'success',
      summary: 'Vale de dinero eliminado',
      detail: `N° ${String(d.numero).padStart(6, '0')}`,
    });
    await this.router.navigate(['/operacion/vales-dinero'], { replaceUrl: true });
  };

  async anular(motivo: string): Promise<void> {
    const d = this.dto();
    if (!d) return;
    this.dto.set(await this.api.post<ValeDineroDto>(`vales-dinero/${d.id}/anular`, { motivo }));
    this.construir();
    this.mensajes.add({
      severity: 'success',
      summary: 'Vale anulado',
      detail: `N° ${String(d.numero).padStart(6, '0')}`,
    });
  }
}
