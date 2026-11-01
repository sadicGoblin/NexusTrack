import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Tooltip } from 'primeng/tooltip';
import {
  formatearFecha,
  hoyIso,
  totalLineaGuia,
  type OrdenCargaDto,
  type OrdenRetiroDto,
  type ResumenRetiroDto,
  type RutaTarifaDto,
} from '@nexustrack/shared';
import { ApiService } from '../../nucleo/api.service';
import { DatosMaestrosService, type Opcion } from '../../nucleo/datos-maestros.service';
import { dateAIso, isoADate } from '../../nucleo/fechas';
import { CorrelativoPipe, PesosPipe } from '../../nucleo/pipes';
import { SesionService } from '../../nucleo/sesion.service';
import { Cargando } from '../../compartido/cargando';
import { BarraDocumento } from '../../compartido/documentos/barra-documento';
import { ResumenRetiro } from '../../compartido/documentos/resumen-retiro';
import { SelectorPadre } from '../../compartido/documentos/selector-padre';
import { CampoFecha } from '../../compartido/formulario/campo-fecha';
import { CamposFormulario } from '../../compartido/formulario/campos-formulario';
import {
  aEntrada,
  construirFormulario,
  type CampoFormulario,
} from '../../compartido/formulario/formulario';
import { aResumen, COLUMNAS_RETIROS } from './comun';

type FormGuia = FormGroup<{
  numeroGuia: FormControl<string | null>;
  fechaGuia: FormControl<Date | null>;
  especieId: FormControl<number | null>;
  umEspecieId: FormControl<number | null>;
  cantidadEspecie: FormControl<number | null>;
  numeroContenedor: FormControl<string | null>;
  tramoId: FormControl<number | null>;
  umTarifaId: FormControl<number | null>;
  cantidadTarifa: FormControl<number | null>;
  valorUnitario: FormControl<number | null>;
}>;

@Component({
  selector: 'nt-orden-carga',
  imports: [
    BarraDocumento,
    Cargando,
    ResumenRetiro,
    SelectorPadre,
    CamposFormulario,
    ReactiveFormsModule,
    Button,
    Select,
    CampoFecha,
    InputNumber,
    InputText,
    Message,
    Tooltip,
    RouterLink,
    PesosPipe,
    CorrelativoPipe,
  ],
  templateUrl: './orden-carga.html',
})
export class OrdenCarga {
  private readonly api = inject(ApiService);
  private readonly maestros = inject(DatosMaestrosService);
  private readonly sesion = inject(SesionService);
  private readonly mensajes = inject(MessageService);
  private readonly router = inject(Router);

  readonly id = input<string>();
  /** Parámetro de consulta: orden de retiro de la que nace la orden de carga. */
  readonly retiro = input<string>();

  readonly dto = signal<OrdenCargaDto | null>(null);
  readonly resumen = signal<ResumenRetiroDto | null>(null);
  readonly candidatos = signal<OrdenRetiroDto[]>([]);
  readonly cargandoCandidatos = signal(false);
  readonly rutas = signal<RutaTarifaDto[]>([]);
  readonly tramoCabecera = signal<number | null>(null);
  readonly form = signal<FormGroup | null>(null);
  readonly guias = signal<FormArray<FormGuia> | null>(null);
  readonly valoresGuias = signal<{ cantidadTarifa: number | null; valorUnitario: number | null }[]>(
    [],
  );
  readonly fechaCarga = signal<string>(hoyIso());
  readonly guardando = signal(false);

  readonly columnasRetiros = COLUMNAS_RETIROS;
  readonly creando = computed(() => !this.id());
  /** El administrador puede corregir además una orden ya rendida. */
  readonly corrigiendo = computed(
    () => this.dto()?.estado === 'RENDIDA' && this.sesion.puede('editarCerrados'),
  );
  readonly editable = computed(
    () =>
      this.sesion.puede('editarOperacion') &&
      (!this.dto() || this.dto()!.estado === 'ABIERTA' || this.corrigiendo()),
  );
  readonly totalNeto = computed(() =>
    this.valoresGuias().reduce(
      (s, g) => s + totalLineaGuia(g.cantidadTarifa ?? 0, g.valorUnitario ?? 0),
      0,
    ),
  );
  readonly subtitulo = computed(() => {
    const r = this.resumen();
    return r ? `${r.cliente} · ${r.origen} → ${r.destino} · ${r.conductor} · ${r.camion}` : '';
  });

  /**
   * Todos los tramos activos del cliente: primero los de la ruta de la orden de retiro, luego los
   * vigentes a la fecha de carga y al final los que no rigen, marcados con su fecha.
   */
  readonly opcionesTramo = computed<Opcion[]>(() => {
    const fecha = this.fechaCarga();
    const r0 = this.resumen();
    const pesos = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });
    return this.rutas()
      .filter((r) => r.activo || this.usado(r.id))
      .map((r) => ({
        r,
        fuera: fueraDeVigencia(r, fecha),
        deLaRuta: !!r0 && r.origen === r0.origen && r.destino === r0.destino,
      }))
      .sort(
        (a, b) =>
          Number(b.deLaRuta) - Number(a.deLaRuta) ||
          Number(!!a.fuera) - Number(!!b.fuera) ||
          a.r.tramo.localeCompare(b.r.tramo, 'es'),
      )
      .map(({ r, fuera }) => ({
        label: r.tramo,
        value: r.id,
        detalle: `${pesos.format(r.valor)}${fuera ? ` · ${fuera}` : ''}`,
        alerta: !!fuera,
      }));
  });

  /** Aviso cuando la tarifa del tramo elegido no rige a la fecha de carga. */
  readonly avisoTramo = computed(() => {
    const r = this.rutas().find((x) => x.id === this.tramoCabecera());
    return r ? fueraDeVigencia(r, this.fechaCarga()) : null;
  });

  readonly camposCabecera: CampoFormulario[] = [
    {
      campo: 'tramoId',
      etiqueta: 'Tramo',
      tipo: 'select',
      ancho: 2,
      opciones: () => this.opcionesTramo(),
      ayuda: 'Tramos del cliente; primero los de la ruta de la orden.',
    },
    {
      campo: 'fechaCarga',
      etiqueta: 'Fecha de carga',
      tipo: 'fecha',
      requerido: true,
      ayuda: 'Rige el correlativo de la hoja de ruta.',
    },
    { campo: 'horaCarga', etiqueta: 'Hora de carga', tipo: 'hora' },
    {
      campo: 'packingCargaId',
      etiqueta: 'Packing de carga',
      tipo: 'select',
      ancho: 2,
      opciones: () => this.maestros.opcionesPackings(this.resumen()?.clienteId),
    },
    { campo: 'observaciones', etiqueta: 'Observaciones', tipo: 'texto', ancho: 2, max: 1000 },
  ];

  opcionesCatalogo(tipo: 'ESPECIE' | 'UM_ESPECIE' | 'UM_TARIFA') {
    return this.maestros.opcionesCatalogo(tipo);
  }

  constructor() {
    effect(() => {
      const id = this.id();
      const retiro = this.retiro();
      untracked(() => void this.cargar(id, retiro));
    });
  }

  private usado(rutaId: number): boolean {
    return this.dto()?.tramoId === rutaId || !!this.dto()?.guias.some((g) => g.tramoId === rutaId);
  }

  private async cargar(id: string | undefined, retiroId: string | undefined): Promise<void> {
    await this.maestros.asegurar('catalogos', 'packings');
    if (id) {
      const d = await this.api.get<OrdenCargaDto>(`ordenes-carga/${id}`);
      this.dto.set(d);
      this.resumen.set(d.retiro);
      await this.cargarRutas(d.retiro.clienteId);
      this.construir();
    } else if (retiroId) {
      const r = await this.api.get<OrdenRetiroDto>(`ordenes-retiro/${retiroId}`);
      this.resumen.set(aResumen(r));
      await this.cargarRutas(r.clienteId);
      this.construir();
    } else {
      this.cargandoCandidatos.set(true);
      try {
        this.candidatos.set(
          await this.api.get<OrdenRetiroDto[]>('ordenes-retiro', { sinCarga: true }),
        );
      } finally {
        this.cargandoCandidatos.set(false);
      }
    }
  }

  private async cargarRutas(clienteId: number): Promise<void> {
    this.rutas.set(await this.api.get<RutaTarifaDto[]>('rutas-tarifas', { clienteId }));
  }

  elegirRetiro(id: number): void {
    void this.router.navigate([], { queryParams: { retiro: id } });
  }

  private construir(): void {
    const d = this.dto();
    const r = this.resumen()!;
    const form = construirFormulario(
      this.camposCabecera,
      d ?? {
        fechaCarga: r.fechaCarga ?? hoyIso(),
        horaCarga: r.horaCarga,
        packingCargaId: r.packingCargaId,
      },
      !!d,
    );
    const guias = new FormArray<FormGuia>(
      (d?.guias ?? []).map((g) => this.nuevaGuia({ ...g, fechaGuia: isoADate(g.fechaGuia) })),
    );
    if (!d) guias.push(this.nuevaGuia({ fechaGuia: isoADate(r.fechaCarga ?? hoyIso()) }));
    if (!this.editable()) {
      form.disable();
      guias.disable();
    }
    form
      .get('fechaCarga')!
      .valueChanges.subscribe((f: Date | null) => this.fechaCarga.set(dateAIso(f) ?? hoyIso()));
    form.get('tramoId')!.valueChanges.subscribe((tramoId: number | null) => {
      this.tramoCabecera.set(tramoId);
      // Si las guías aún no tienen tramo, toman el de la cabecera.
      for (const g of guias.controls)
        if (!g.controls.tramoId.value && tramoId) this.elegirTramo(g, tramoId);
    });
    guias.valueChanges.subscribe(() => this.valoresGuias.set(guias.getRawValue()));
    this.fechaCarga.set(dateAIso(form.get('fechaCarga')!.value) ?? hoyIso());
    this.tramoCabecera.set(form.get('tramoId')!.value);
    this.valoresGuias.set(guias.getRawValue());
    this.form.set(form);
    this.guias.set(guias);
  }

  private nuevaGuia(v: Partial<Record<string, unknown>> = {}): FormGuia {
    return new FormGroup({
      numeroGuia: new FormControl<string | null>((v['numeroGuia'] as string) ?? null, [
        Validators.required,
        Validators.maxLength(30),
      ]),
      fechaGuia: new FormControl<Date | null>(
        (v['fechaGuia'] as Date) ?? null,
        Validators.required,
      ),
      especieId: new FormControl<number | null>((v['especieId'] as number) ?? null),
      umEspecieId: new FormControl<number | null>((v['umEspecieId'] as number) ?? null),
      cantidadEspecie: new FormControl<number | null>((v['cantidadEspecie'] as number) ?? null),
      numeroContenedor: new FormControl<string | null>(
        (v['numeroContenedor'] as string) ?? null,
        Validators.maxLength(30),
      ),
      tramoId: new FormControl<number | null>(
        (v['tramoId'] as number) ?? null,
        Validators.required,
      ),
      umTarifaId: new FormControl<number | null>((v['umTarifaId'] as number) ?? null),
      cantidadTarifa: new FormControl<number | null>((v['cantidadTarifa'] as number) ?? 1, [
        Validators.required,
        Validators.min(0),
      ]),
      valorUnitario: new FormControl<number | null>((v['valorUnitario'] as number) ?? null, [
        Validators.required,
        Validators.min(0),
      ]),
    });
  }

  /** Agrega una guía copiando los datos de la anterior (mismo número de guía, contenedor y especie). */
  agregarGuia(): void {
    const guias = this.guias();
    if (!guias) return;
    const anterior = guias.at(guias.length - 1)?.getRawValue();
    const tramoCabecera = this.form()?.get('tramoId')?.value ?? null;
    const nueva = this.nuevaGuia({
      numeroGuia: anterior?.numeroGuia,
      fechaGuia: anterior?.fechaGuia ?? isoADate(this.fechaCarga()),
      especieId: anterior?.especieId,
      umEspecieId: anterior?.umEspecieId,
      cantidadEspecie: anterior?.cantidadEspecie,
      numeroContenedor: anterior?.numeroContenedor,
    });
    guias.push(nueva);
    if (tramoCabecera && !anterior) this.elegirTramo(nueva, tramoCabecera);
  }

  quitarGuia(i: number): void {
    this.guias()?.removeAt(i);
  }

  /** Asigna el tramo a una guía y propone su valor como valor unitario (editable). */
  elegirTramo(g: FormGuia, tramoId: number | null): void {
    g.controls.tramoId.setValue(tramoId);
    this.proponerValor(g, tramoId);
  }

  /** Tramo elegido en una guía: propone su valor y, si la cabecera no tiene tramo, lo toma. */
  tramoDeGuia(g: FormGuia, tramoId: number | null): void {
    this.proponerValor(g, tramoId);
    const cabecera = this.form()?.get('tramoId');
    if (cabecera && !cabecera.value && tramoId) cabecera.setValue(tramoId);
  }

  proponerValor(g: FormGuia, tramoId: number | null): void {
    const ruta = this.rutas().find((r) => r.id === tramoId);
    if (ruta) g.controls.valorUnitario.setValue(ruta.valor);
  }

  totalGuia(i: number): number {
    const v = this.valoresGuias()[i];
    return v ? totalLineaGuia(v.cantidadTarifa ?? 0, v.valorUnitario ?? 0) : 0;
  }

  async guardar(): Promise<void> {
    const form = this.form();
    const guias = this.guias();
    const r = this.resumen();
    if (!form || !guias || !r) return;
    if (form.invalid || guias.invalid) {
      form.markAllAsTouched();
      guias.markAllAsTouched();
      this.mensajes.add({
        severity: 'warn',
        summary: 'Revise los datos',
        detail: 'Complete los campos obligatorios de la cabecera y de cada guía.',
      });
      return;
    }
    const entrada = {
      ...aEntrada(this.camposCabecera, form),
      ordenRetiroId: r.id,
      guias: guias.getRawValue().map((g) => ({ ...g, fechaGuia: dateAIso(g.fechaGuia) })),
    };
    this.guardando.set(true);
    try {
      const d = this.dto();
      const res = d
        ? await this.api.put<OrdenCargaDto>(`ordenes-carga/${d.id}`, entrada)
        : await this.api.post<OrdenCargaDto>('ordenes-carga', entrada);
      this.mensajes.add({
        severity: 'success',
        summary: d ? 'Cambios guardados' : 'Orden de carga emitida',
        detail: `N° ${String(res.numero).padStart(6, '0')}${res.hojaRuta ? ` · hoja de ruta N° ${String(res.hojaRuta).padStart(6, '0')}` : ''}`,
      });
      if (d) {
        this.dto.set(res);
        this.construir();
      } else {
        await this.router.navigate(['/operacion/ordenes-carga', res.id], { replaceUrl: true });
      }
    } finally {
      this.guardando.set(false);
    }
  }

  /** Solo administradores (ver BarraDocumento). */
  readonly eliminarDocumento = async (): Promise<void> => {
    const d = this.dto();
    if (!d) return;
    await this.api.eliminar(`ordenes-carga/${d.id}`);
    this.mensajes.add({
      severity: 'success',
      summary: 'Orden de carga eliminada',
      detail: `N° ${String(d.numero).padStart(6, '0')}`,
    });
    await this.router.navigate(['/operacion/ordenes-carga'], { replaceUrl: true });
  };

  async anular(motivo: string): Promise<void> {
    const d = this.dto();
    if (!d) return;
    this.dto.set(await this.api.post<OrdenCargaDto>(`ordenes-carga/${d.id}/anular`, { motivo }));
    this.resumen.set(this.dto()!.retiro);
    this.construir();
    this.mensajes.add({
      severity: 'success',
      summary: 'Orden de carga anulada',
      detail: 'La orden de retiro queda abierta para emitir una nueva.',
    });
  }
}

/** Por qué la tarifa no rige en la fecha, o null si rige. */
function fueraDeVigencia(r: RutaTarifaDto, fecha: string): string | null {
  if (r.vigenciaHasta && r.vigenciaHasta < fecha)
    return `venció el ${formatearFecha(r.vigenciaHasta)}`;
  if (r.vigenciaDesde && r.vigenciaDesde > fecha)
    return `rige desde el ${formatearFecha(r.vigenciaDesde)}`;
  return null;
}
