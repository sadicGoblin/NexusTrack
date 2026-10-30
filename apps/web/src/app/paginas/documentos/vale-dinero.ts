import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { type FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import {
  hoyIso,
  type OrdenRetiroDto,
  type ResumenRetiroDto,
  type ValeDineroDto,
} from '@nexustrack/shared';
import { ApiService } from '../../nucleo/api.service';
import { DatosMaestrosService } from '../../nucleo/datos-maestros.service';
import { SesionService } from '../../nucleo/sesion.service';
import { BarraDocumento } from '../../compartido/documentos/barra-documento';
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
  imports: [BarraDocumento, ResumenRetiro, SelectorPadre, CamposFormulario, Message],
  template: `
    @if (creando() && !retiro()) {
      <nt-barra-documento titulo="Nuevo vale de dinero" volver="/operacion/vales-dinero" />
      <nt-selector-padre
        titulo="Órdenes de retiro activas"
        instrucciones="Seleccione la orden de retiro a la que asignará el vale de dinero (anticipo de viaje)."
        [filas]="candidatos()"
        [columnas]="columnasRetiros"
        [cargando]="cargandoCandidatos()"
        (elegir)="elegirRetiro($event)"
      />
    } @else {
      <nt-barra-documento
        titulo="Vale de dinero"
        [subtitulo]="resumen() ? 'Anticipo de viaje · ' + resumen()!.conductor : ''"
        [numero]="dto()?.numero ?? null"
        [estado]="dto()?.estado ?? null"
        [recurso]="'vales-dinero/' + dto()?.id"
        volver="/operacion/vales-dinero"
        [editable]="editable() && !!form()"
        [anulable]="dto()?.estado === 'EMITIDO'"
        [guardando]="guardando()"
        (guardar)="guardar()"
        (anular)="anular($event)"
      />
      @if (dto()?.estado === 'ANULADO') {
        <p-message severity="error" style="display: block; margin-bottom: 1rem"
          >Vale anulado. Motivo: {{ dto()?.motivoAnulacion }}</p-message
        >
      }
      @if (resumen(); as r) {
        <nt-resumen-retiro [retiro]="r" />
      }
      @if (form(); as f) {
        <section class="nt-tarjeta">
          <div class="nt-tarjeta-titulo"><h2>Anticipo</h2></div>
          <nt-campos [form]="f" [campos]="campos" [soloLectura]="!editable()" />
        </section>
      }
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

  readonly dto = signal<ValeDineroDto | null>(null);
  readonly resumen = signal<ResumenRetiroDto | null>(null);
  readonly candidatos = signal<OrdenRetiroDto[]>([]);
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
      untracked(() => void this.cargar(id, retiro));
    });
  }

  private async cargar(id?: string, retiroId?: string): Promise<void> {
    await this.maestros.asegurar('catalogos', 'parametros');
    if (id) {
      const d = await this.api.get<ValeDineroDto>(`vales-dinero/${id}`);
      this.dto.set(d);
      this.resumen.set(d.retiro);
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
    if (!form || !r) return;
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
      const entrada = { ...aEntrada(this.campos, form), ordenRetiroId: r.id };
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
