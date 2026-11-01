import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { type FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import {
  calcularCombustible,
  GRUPOS_MOVIL,
  hoyIso,
  TIPOS_REMOLQUE,
  type OrdenRetiroDto,
  type ResumenRetiroDto,
  type ValeCombustibleDto,
} from '@nexustrack/shared';
import { ApiService } from '../../nucleo/api.service';
import { DatosMaestrosService } from '../../nucleo/datos-maestros.service';
import { NumeroPipe, PesosPipe } from '../../nucleo/pipes';
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
  selector: 'nt-vale-combustible',
  imports: [
    BarraDocumento,
    ResumenRetiro,
    SelectorPadre,
    CamposFormulario,
    Message,
    PesosPipe,
    NumeroPipe,
  ],
  template: `
    @if (creando() && !retiro()) {
      <nt-barra-documento
        titulo="Nuevo vale de combustible"
        volver="/operacion/vales-combustible"
      />
      <nt-selector-padre
        titulo="Órdenes de retiro activas"
        instrucciones="La orden de entrega de combustible se genera al terminar el flete. Seleccione la orden de retiro correspondiente."
        [filas]="candidatos()"
        [columnas]="columnasRetiros"
        [cargando]="cargandoCandidatos()"
        (elegir)="elegirRetiro($event)"
      />
    } @else {
      <nt-barra-documento
        titulo="Vale de combustible"
        [subtitulo]="resumen() ? 'Orden de entrega de combustible · ' + resumen()!.conductor : ''"
        [numero]="dto()?.numero ?? null"
        [estado]="dto()?.estado ?? null"
        [recurso]="'vales-combustible/' + dto()?.id"
        volver="/operacion/vales-combustible"
        [editable]="editable() && !!form()"
        [anulable]="dto()?.estado === 'EMITIDO'"
        [eliminable]="!!dto()"
        [eliminar]="eliminarDocumento"
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
          <div class="nt-tarjeta-titulo"><h2>Entrega</h2></div>
          <nt-campos [form]="f" [campos]="camposEntrega" [soloLectura]="!editable()" />
        </section>
        <section class="nt-tarjeta">
          <div class="nt-tarjeta-titulo">
            <h2>Carga de combustible</h2>
            <small
              >Los litros se calculan como numeral final menos numeral inicial de la bomba.</small
            >
          </div>
          <nt-campos [form]="f" [campos]="camposCarga" [soloLectura]="!editable()" />
          <div class="nt-totales">
            <div class="total">
              <span>Litros camión</span><strong>{{ calculo().litrosCamion | numero: 2 }}</strong>
            </div>
            <div class="total">
              <span>Litros remolque</span
              ><strong>{{ calculo().litrosRemolque | numero: 2 }}</strong>
            </div>
            <div class="total">
              <span>Total litros</span><strong>{{ calculo().totalLitros | numero: 2 }}</strong>
            </div>
            <div class="total principal">
              <span>Total</span><strong>{{ calculo().total | pesos }}</strong>
            </div>
          </div>
        </section>
      }
    }
  `,
})
export class ValeCombustible {
  private readonly api = inject(ApiService);
  private readonly maestros = inject(DatosMaestrosService);
  private readonly sesion = inject(SesionService);
  private readonly mensajes = inject(MessageService);
  private readonly router = inject(Router);

  readonly id = input<string>();
  readonly retiro = input<string>();

  readonly dto = signal<ValeCombustibleDto | null>(null);
  readonly resumen = signal<ResumenRetiroDto | null>(null);
  readonly candidatos = signal<OrdenRetiroDto[]>([]);
  readonly cargandoCandidatos = signal(false);
  readonly form = signal<FormGroup | null>(null);
  readonly valores = signal<Record<string, any>>({});
  readonly guardando = signal(false);

  readonly columnasRetiros = COLUMNAS_RETIROS;
  readonly creando = computed(() => !this.id());
  readonly editable = computed(
    () => this.sesion.puede('editarFinanzas') && (!this.dto() || this.dto()!.estado === 'EMITIDO'),
  );
  readonly calculo = computed(() => {
    const v = this.valores();
    return calcularCombustible({
      numeralInicialCamion: v['numeralInicialCamion'],
      numeralFinalCamion: v['numeralFinalCamion'],
      numeralInicialRemolque: v['numeralInicialRemolque'],
      numeralFinalRemolque: v['numeralFinalRemolque'],
      valorLitro: v['valorLitro'] ?? 0,
    });
  });

  readonly camposEntrega: CampoFormulario[] = [
    { campo: 'fechaEntrega', etiqueta: 'Fecha de entrega', tipo: 'fecha', requerido: true },
    { campo: 'horaEntrega', etiqueta: 'Hora de entrega', tipo: 'hora' },
    {
      campo: 'sitioEntregaId',
      etiqueta: 'Sitio de entrega',
      tipo: 'select',
      requerido: true,
      ancho: 2,
      opciones: (v) => this.maestros.opcionesCatalogo('SITIO_ENTREGA', v['sitioEntregaId']),
    },
    {
      campo: 'formaPagoId',
      etiqueta: 'Forma de pago',
      tipo: 'select',
      opciones: (v) => this.maestros.opcionesCatalogo('FORMA_PAGO', v['formaPagoId']),
    },
    {
      campo: 'tipoDocumentoId',
      etiqueta: 'Tipo de documento',
      tipo: 'select',
      opciones: (v) => this.maestros.opcionesCatalogo('TIPO_DOCUMENTO', v['tipoDocumentoId']),
    },
    { campo: 'observaciones', etiqueta: 'Observaciones', tipo: 'texto', ancho: 2, max: 1000 },
  ];

  readonly camposCarga: CampoFormulario[] = [
    {
      campo: 'camionId',
      etiqueta: 'Patente camión',
      tipo: 'select',
      requerido: true,
      opciones: () => this.maestros.opcionesMoviles(GRUPOS_MOVIL.camion),
    },
    {
      campo: 'numeralInicialCamion',
      etiqueta: 'Numeral inicial bomba (camión)',
      tipo: 'decimal',
      decimales: 2,
      min: 0,
    },
    {
      campo: 'numeralFinalCamion',
      etiqueta: 'Numeral final bomba (camión)',
      tipo: 'decimal',
      decimales: 2,
      min: 0,
    },
    {
      campo: 'valorLitro',
      etiqueta: 'Valor litro',
      tipo: 'pesos',
      requerido: true,
      min: 1,
      ayuda: 'Valor por defecto de Parámetros; editable.',
    },
    {
      campo: 'remolqueId',
      etiqueta: 'Patente remolque',
      tipo: 'select',
      opciones: () => this.maestros.opcionesMoviles(TIPOS_REMOLQUE),
    },
    {
      campo: 'numeralInicialRemolque',
      etiqueta: 'Numeral inicial bomba (remolque)',
      tipo: 'decimal',
      decimales: 2,
      min: 0,
    },
    {
      campo: 'numeralFinalRemolque',
      etiqueta: 'Numeral final bomba (remolque)',
      tipo: 'decimal',
      decimales: 2,
      min: 0,
    },
  ];
  private readonly campos = [...this.camposEntrega, ...this.camposCarga];

  constructor() {
    effect(() => {
      const id = this.id();
      const retiro = this.retiro();
      untracked(() => void this.cargar(id, retiro));
    });
  }

  private async cargar(id?: string, retiroId?: string): Promise<void> {
    await this.maestros.asegurar('catalogos', 'parametros', 'moviles');
    if (id) {
      const d = await this.api.get<ValeCombustibleDto>(`vales-combustible/${id}`);
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
    const r = this.resumen()!;
    const valorLitro = Number(this.maestros.parametro('VALOR_LITRO_COMBUSTIBLE')) || null;
    const form = construirFormulario(
      this.campos,
      d ?? { fechaEntrega: hoyIso(), camionId: r.camionId, remolqueId: r.remolqueId, valorLitro },
      !!d,
    );
    if (!this.editable()) form.disable();
    form.valueChanges.subscribe(() => this.valores.set(form.getRawValue()));
    this.valores.set(form.getRawValue());
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
        ? await this.api.put<ValeCombustibleDto>(`vales-combustible/${d.id}`, entrada)
        : await this.api.post<ValeCombustibleDto>('vales-combustible', entrada);
      this.mensajes.add({
        severity: 'success',
        summary: d ? 'Cambios guardados' : 'Vale de combustible emitido',
        detail: `N° ${String(res.numero).padStart(6, '0')}`,
      });
      if (d) {
        this.dto.set(res);
        this.construir();
      } else {
        await this.router.navigate(['/operacion/vales-combustible', res.id], { replaceUrl: true });
      }
    } finally {
      this.guardando.set(false);
    }
  }

  /** Solo administradores (ver BarraDocumento). */
  readonly eliminarDocumento = async (): Promise<void> => {
    const d = this.dto();
    if (!d) return;
    await this.api.eliminar(`vales-combustible/${d.id}`);
    this.mensajes.add({
      severity: 'success',
      summary: 'Vale de combustible eliminado',
      detail: `N° ${String(d.numero).padStart(6, '0')}`,
    });
    await this.router.navigate(['/operacion/vales-combustible'], { replaceUrl: true });
  };

  async anular(motivo: string): Promise<void> {
    const d = this.dto();
    if (!d) return;
    this.dto.set(
      await this.api.post<ValeCombustibleDto>(`vales-combustible/${d.id}/anular`, { motivo }),
    );
    this.construir();
    this.mensajes.add({
      severity: 'success',
      summary: 'Vale anulado',
      detail: `N° ${String(d.numero).padStart(6, '0')}`,
    });
  }
}
