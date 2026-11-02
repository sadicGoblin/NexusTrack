import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Tooltip } from 'primeng/tooltip';
import {
  calcularRendicion,
  hoyIso,
  sumarDias,
  totalViatico,
  type OrdenCargaDto,
  type RendicionDto,
  type ResumenRetiroDto,
} from '@nexustrack/shared';
import { ApiService } from '../../nucleo/api.service';
import { DatosMaestrosService } from '../../nucleo/datos-maestros.service';
import { dateAIso, isoADate } from '../../nucleo/fechas';
import { CorrelativoPipe, FechaPipe, NumeroPipe, PesosPipe } from '../../nucleo/pipes';
import { SesionService } from '../../nucleo/sesion.service';
import { Cargando } from '../../compartido/cargando';
import { BarraDocumento } from '../../compartido/documentos/barra-documento';
import { CuentaConductor } from '../../compartido/documentos/cuenta-conductor';
import { Dato } from '../../compartido/documentos/dato';
import { ResumenRetiro } from '../../compartido/documentos/resumen-retiro';
import { SelectorPadre } from '../../compartido/documentos/selector-padre';
import { CampoFecha } from '../../compartido/formulario/campo-fecha';
import { CamposFormulario } from '../../compartido/formulario/campos-formulario';
import { RutInput } from '../../compartido/formulario/rut';
import {
  aEntrada,
  construirFormulario,
  validadorRut,
  type CampoFormulario,
} from '../../compartido/formulario/formulario';
import { COLUMNAS_CARGAS } from './comun';

type FormViatico = FormGroup<{
  fecha: FormControl<Date | null>;
  desayuno: FormControl<number | null>;
  almuerzo: FormControl<number | null>;
  comida: FormControl<number | null>;
}>;

type FormGasto = FormGroup<{
  tipoDocumentoId: FormControl<number | null>;
  numeroDocumento: FormControl<string | null>;
  rutProveedor: FormControl<string | null>;
  fecha: FormControl<Date | null>;
  monto: FormControl<number | null>;
  itemGastoId: FormControl<number | null>;
  observaciones: FormControl<string | null>;
}>;

interface CabeceraCarga {
  id: number;
  numero: number;
  hojaRuta: number | null;
  tramo: string | null;
  fechaCarga: string;
  horaCarga: string | null;
  packingCarga: string | null;
  patenteCamion: string;
  patenteRemolque: string | null;
  totalNeto: number | null;
}

@Component({
  selector: 'nt-rendicion',
  imports: [
    BarraDocumento,
    Cargando,
    CuentaConductor,
    ResumenRetiro,
    SelectorPadre,
    CamposFormulario,
    Dato,
    ReactiveFormsModule,
    Button,
    CampoFecha,
    RutInput,
    InputNumber,
    InputText,
    Select,
    SelectButton,
    Message,
    Tooltip,
    PesosPipe,
    CorrelativoPipe,
    FechaPipe,
    NumeroPipe,
  ],
  templateUrl: './rendicion.html',
})
export class Rendicion {
  private readonly api = inject(ApiService);
  private readonly maestros = inject(DatosMaestrosService);
  private readonly sesion = inject(SesionService);
  private readonly mensajes = inject(MessageService);
  private readonly router = inject(Router);

  readonly id = input<string>();
  /** Parámetro de consulta: orden de carga que se rinde. */
  readonly carga = input<string>();

  readonly dto = signal<RendicionDto | null>(null);
  readonly cabecera = signal<CabeceraCarga | null>(null);
  readonly resumen = signal<ResumenRetiroDto | null>(null);
  readonly candidatos = signal<Record<string, unknown>[]>([]);
  readonly cargandoCandidatos = signal(false);
  readonly form = signal<FormGroup | null>(null);
  readonly viaticos = signal<FormArray<FormViatico> | null>(null);
  readonly gastos = signal<FormArray<FormGasto> | null>(null);
  readonly valores = signal<{ cabecera: Record<string, any>; viaticos: any[]; gastos: any[] }>({
    cabecera: {},
    viaticos: [],
    gastos: [],
  });
  readonly guardando = signal(false);

  readonly columnasCargas = COLUMNAS_CARGAS;
  readonly creando = computed(() => !this.id());
  readonly editable = computed(
    () => this.sesion.puede('editarFinanzas') && (!this.dto() || this.dto()!.estado === 'EMITIDO'),
  );
  readonly totales = computed(() => {
    const v = this.valores();
    return calcularRendicion({ ...v.cabecera, viaticos: v.viaticos, gastos: v.gastos });
  });

  readonly camposViaje: CampoFormulario[] = [
    { campo: 'fecha', etiqueta: 'Fecha de rendición', tipo: 'fecha', requerido: true },
    { campo: 'fechaSalida', etiqueta: 'Fecha salida', tipo: 'fecha' },
    { campo: 'horaSalida', etiqueta: 'Hora salida', tipo: 'hora' },
    { campo: 'odometroInicial', etiqueta: 'Odómetro inicial', tipo: 'entero', min: 0 },
    {
      campo: 'horometroInicial',
      etiqueta: 'Horómetro inicial',
      tipo: 'decimal',
      decimales: 1,
      min: 0,
    },
    { campo: 'fechaEntrega', etiqueta: 'Fecha de entrega', tipo: 'fecha' },
    { campo: 'fechaLlegada', etiqueta: 'Fecha llegada', tipo: 'fecha' },
    { campo: 'horaLlegada', etiqueta: 'Hora llegada', tipo: 'hora' },
    { campo: 'odometroFinal', etiqueta: 'Odómetro final', tipo: 'entero', min: 0 },
    { campo: 'horometroFinal', etiqueta: 'Horómetro final', tipo: 'decimal', decimales: 1, min: 0 },
    {
      campo: 'sitioEntregaId',
      etiqueta: 'Sitio de entrega',
      tipo: 'select',
      opciones: (v) => this.maestros.opcionesCatalogo('SITIO_ENTREGA', v['sitioEntregaId']),
    },
    { campo: 'observaciones', etiqueta: 'Observaciones', tipo: 'texto', ancho: 2, max: 1000 },
    {
      campo: 'kmRecorridos',
      etiqueta: 'Kilómetros recorridos',
      tipo: 'calculado',
      calcular: () =>
        this.totales().kmRecorridos !== null
          ? `${this.totales().kmRecorridos!.toLocaleString('es-CL')} km`
          : '',
    },
    {
      campo: 'horasMotor',
      etiqueta: 'Total horas',
      tipo: 'calculado',
      calcular: () =>
        this.totales().horasMotor !== null
          ? `${this.totales().horasMotor!.toLocaleString('es-CL')} h`
          : '',
      ayuda: 'Motor del remolque: horómetro final − inicial.',
    },
  ];

  /** Lo indica el conductor: si el motor del remolque funcionó en el flete (se cobra aparte). */
  readonly opcionesMotor = [
    { label: 'Con motor', value: true },
    { label: 'Sin motor', value: false },
  ];

  readonly camposGastos: CampoFormulario[] = [
    { campo: 'peajes', etiqueta: 'Peajes', tipo: 'pesos' },
    { campo: 'carga', etiqueta: 'Carga', tipo: 'pesos' },
    { campo: 'descarga', etiqueta: 'Descarga', tipo: 'pesos' },
    {
      campo: 'petroleo',
      etiqueta: 'Petróleo',
      tipo: 'pesos',
      ayuda: 'Pagado en ruta con el anticipo.',
    },
  ];
  private readonly campos = [...this.camposViaje, ...this.camposGastos];

  opciones(tipo: 'TIPO_DOCUMENTO' | 'ITEM_GASTO') {
    return this.maestros.opcionesCatalogo(tipo);
  }

  constructor() {
    effect(() => {
      const id = this.id();
      const carga = this.carga();
      untracked(() => void this.cargar(id, carga));
    });
  }

  private async cargar(id?: string, cargaId?: string): Promise<void> {
    await this.maestros.asegurar('catalogos');
    if (id) {
      const d = await this.api.get<RendicionDto>(`rendiciones/${id}`);
      this.dto.set(d);
      this.resumen.set(d.retiro);
      this.cabecera.set({
        id: d.ordenCargaId,
        numero: d.ordenCargaNumero,
        hojaRuta: null,
        tramo: d.tramo,
        fechaCarga: d.fechaCarga,
        horaCarga: d.horaCarga,
        packingCarga: d.packingCarga,
        patenteCamion: d.patenteCamion,
        patenteRemolque: d.patenteRemolque,
        totalNeto: null,
      });
      this.construir();
    } else if (cargaId) {
      const oc = await this.api.get<OrdenCargaDto>(`ordenes-carga/${cargaId}`);
      this.resumen.set(oc.retiro);
      this.cabecera.set(oc);
      this.construir();
    } else {
      this.cargandoCandidatos.set(true);
      try {
        const cargas = await this.api.get<OrdenCargaDto[]>('ordenes-carga', { porRendir: true });
        this.candidatos.set(
          cargas.map((o) => ({
            id: o.id,
            numero: o.numero,
            hojaRuta: o.hojaRuta,
            fechaCarga: o.fechaCarga,
            cliente: o.retiro.cliente,
            conductor: o.retiro.conductor,
            patenteCamion: o.patenteCamion,
            tramo: o.tramo,
            totalNeto: o.totalNeto,
          })),
        );
      } finally {
        this.cargandoCandidatos.set(false);
      }
    }
  }

  elegirCarga(id: number): void {
    void this.router.navigate([], { queryParams: { carga: id } });
  }

  private construir(): void {
    const d = this.dto();
    const c = this.cabecera()!;
    const form = construirFormulario(
      this.campos,
      d ?? {
        fecha: hoyIso(),
        fechaSalida: c.fechaCarga,
        peajes: 0,
        carga: 0,
        descarga: 0,
        petroleo: 0,
      },
      !!d,
    );
    form.addControl(
      'remolqueConMotor',
      new FormControl<boolean | null>(d?.remolqueConMotor ?? null),
    );
    const viaticos = new FormArray<FormViatico>(
      (d?.viaticos ?? []).map((v) => this.nuevoViatico({ ...v, fecha: isoADate(v.fecha) })),
    );
    const gastos = new FormArray<FormGasto>(
      (d?.gastos ?? []).map((g) => this.nuevoGasto({ ...g, fecha: isoADate(g.fecha) })),
    );
    if (!this.editable()) {
      form.disable();
      viaticos.disable();
      gastos.disable();
    }
    const actualizar = () =>
      this.valores.set({
        cabecera: form.getRawValue(),
        viaticos: viaticos.getRawValue(),
        gastos: gastos.getRawValue(),
      });
    form.valueChanges.subscribe(actualizar);
    viaticos.valueChanges.subscribe(actualizar);
    gastos.valueChanges.subscribe(actualizar);
    this.form.set(form);
    this.viaticos.set(viaticos);
    this.gastos.set(gastos);
    actualizar();
  }

  private nuevoViatico(v: Record<string, unknown> = {}): FormViatico {
    return new FormGroup({
      fecha: new FormControl<Date | null>((v['fecha'] as Date) ?? null, Validators.required),
      desayuno: new FormControl<number | null>((v['desayuno'] as number) ?? 0, Validators.min(0)),
      almuerzo: new FormControl<number | null>((v['almuerzo'] as number) ?? 0, Validators.min(0)),
      comida: new FormControl<number | null>((v['comida'] as number) ?? 0, Validators.min(0)),
    });
  }

  private nuevoGasto(g: Record<string, unknown> = {}): FormGasto {
    return new FormGroup({
      tipoDocumentoId: new FormControl<number | null>((g['tipoDocumentoId'] as number) ?? null),
      numeroDocumento: new FormControl<string | null>(
        (g['numeroDocumento'] as string) ?? null,
        Validators.maxLength(40),
      ),
      rutProveedor: new FormControl<string | null>(
        (g['rutProveedor'] as string) ?? null,
        validadorRut((g['rutProveedor'] as string) ?? null),
      ),
      fecha: new FormControl<Date | null>((g['fecha'] as Date) ?? null),
      monto: new FormControl<number | null>((g['monto'] as number) ?? null, [
        Validators.required,
        Validators.min(1),
      ]),
      itemGastoId: new FormControl<number | null>((g['itemGastoId'] as number) ?? null),
      observaciones: new FormControl<string | null>(
        (g['observaciones'] as string) ?? null,
        Validators.maxLength(300),
      ),
    });
  }

  /** Nuevo día de viático: el siguiente al último registrado, o la fecha de salida. */
  agregarViatico(): void {
    const lista = this.viaticos();
    if (!lista) return;
    const ultimo = dateAIso(lista.at(lista.length - 1)?.controls.fecha.value);
    const base = ultimo
      ? sumarDias(ultimo, 1)
      : (dateAIso(this.form()?.get('fechaSalida')?.value) ?? hoyIso());
    lista.push(this.nuevoViatico({ fecha: isoADate(base) }));
  }

  agregarGasto(): void {
    this.gastos()?.push(this.nuevoGasto({ fecha: this.form()?.get('fechaSalida')?.value ?? null }));
  }

  totalDia(i: number): number {
    return totalViatico(this.valores().viaticos[i] ?? {});
  }

  async guardar(): Promise<void> {
    const form = this.form();
    const viaticos = this.viaticos();
    const gastos = this.gastos();
    const c = this.cabecera();
    if (!form || !viaticos || !gastos || !c) return;
    if (form.invalid || viaticos.invalid || gastos.invalid) {
      for (const f of [form, viaticos, gastos]) f.markAllAsTouched();
      this.mensajes.add({
        severity: 'warn',
        summary: 'Revise los datos',
        detail: 'Hay campos obligatorios o con errores en la rendición.',
      });
      return;
    }
    const entrada = {
      ...aEntrada(this.campos, form),
      remolqueConMotor: form.get('remolqueConMotor')!.value,
      ordenCargaId: c.id,
      viaticos: viaticos.getRawValue().map((v) => ({ ...v, fecha: dateAIso(v.fecha) })),
      gastos: gastos
        .getRawValue()
        .map((g) => ({ ...g, fecha: dateAIso(g.fecha), rutProveedor: g.rutProveedor || null })),
    };
    this.guardando.set(true);
    try {
      const d = this.dto();
      const res = d
        ? await this.api.put<RendicionDto>(`rendiciones/${d.id}`, entrada)
        : await this.api.post<RendicionDto>('rendiciones', entrada);
      this.mensajes.add({
        severity: 'success',
        summary: d ? 'Cambios guardados' : 'Rendición emitida',
        detail: `N° ${String(res.numero).padStart(6, '0')}`,
      });
      if (d) {
        this.dto.set(res);
        this.construir();
      } else {
        await this.router.navigate(['/operacion/rendiciones', res.id], { replaceUrl: true });
      }
    } finally {
      this.guardando.set(false);
    }
  }

  /** Solo administradores (ver BarraDocumento). */
  readonly eliminarDocumento = async (): Promise<void> => {
    const d = this.dto();
    if (!d) return;
    await this.api.eliminar(`rendiciones/${d.id}`);
    this.mensajes.add({
      severity: 'success',
      summary: 'Rendición eliminada',
      detail: `N° ${String(d.numero).padStart(6, '0')}`,
    });
    await this.router.navigate(['/operacion/rendiciones'], { replaceUrl: true });
  };

  async anular(motivo: string): Promise<void> {
    const d = this.dto();
    if (!d) return;
    this.dto.set(await this.api.post<RendicionDto>(`rendiciones/${d.id}/anular`, { motivo }));
    this.construir();
    this.mensajes.add({
      severity: 'success',
      summary: 'Rendición anulada',
      detail: 'La orden de carga vuelve a quedar abierta.',
    });
  }
}
