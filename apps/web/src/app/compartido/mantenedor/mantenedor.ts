import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { type FormGroup } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import type { Permiso } from '@nexustrack/shared';
import { ApiService } from '../../nucleo/api.service';
import { DatosMaestrosService, type Conjunto } from '../../nucleo/datos-maestros.service';
import { SesionService } from '../../nucleo/sesion.service';
import { CamposFormulario } from '../formulario/campos-formulario';
import { aEntrada, construirFormulario, type CampoFormulario } from '../formulario/formulario';
import { TablaDatos, type ColumnaTabla } from '../tabla/tabla-datos';

export interface ConfigMantenedor {
  titulo: string;
  descripcion: string;
  /** Nombre en singular con artículo indefinido para los botones: "empresa", "cliente". */
  singular: string;
  femenino?: boolean;
  recurso: string;
  permiso: Permiso;
  columnas: ColumnaTabla[];
  campos: CampoFormulario[];
  claveEstado: string;
  /** Datos maestros que necesitan las listas del formulario. */
  conjuntos?: Conjunto[];
  /** Conjunto de datos maestros a refrescar después de guardar. */
  invalidar?: Conjunto;
  porDefecto?: () => Record<string, unknown>;
  /** Reacciones entre campos: se llama cuando cambia cualquier valor del formulario. */
  alCambiar?: (form: FormGroup, editando: boolean, campo: string) => void;
  anchoDialogo?: string;
  /** El administrador puede eliminar registros que nada usa (la API lo verifica). */
  eliminable?: boolean;
}

/**
 * Página estándar de mantenedor: grilla con todos los registros y diálogo para crear, editar o,
 * si es administrador, eliminar.
 */
@Component({
  selector: 'nt-mantenedor',
  imports: [TablaDatos, Dialog, Button, CamposFormulario],
  templateUrl: './mantenedor.html',
})
export class Mantenedor implements OnInit {
  private readonly api = inject(ApiService);
  private readonly maestros = inject(DatosMaestrosService);
  private readonly sesion = inject(SesionService);
  private readonly mensajes = inject(MessageService);
  private readonly confirmacion = inject(ConfirmationService);

  readonly config = input.required<ConfigMantenedor>();

  readonly filas = signal<Record<string, unknown>[]>([]);
  readonly cargando = signal(true);
  readonly dialogo = signal(false);
  readonly guardando = signal(false);
  readonly editando = signal<Record<string, unknown> | null>(null);
  readonly form = signal<FormGroup | null>(null);

  readonly puedeEditar = computed(() => this.sesion.puede(this.config().permiso));
  /** Al crear se ocultan los campos que asigna el sistema. */
  readonly campos = computed(() =>
    this.editando() ? this.config().campos : this.config().campos.filter((c) => !c.automatico),
  );
  readonly puedeEliminar = computed(
    () => !!this.config().eliminable && !!this.editando() && this.sesion.puede('eliminar'),
  );
  readonly tituloDialogo = computed(() => {
    const c = this.config();
    if (!this.editando()) return `${c.femenino ? 'Nueva' : 'Nuevo'} ${c.singular}`;
    return this.puedeEditar() ? `Editar ${c.singular}` : `Detalle de ${c.singular}`;
  });

  async ngOnInit(): Promise<void> {
    const c = this.config();
    await Promise.all([this.cargar(), this.maestros.asegurar(...(c.conjuntos ?? []))]);
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.filas.set(await this.api.get(this.config().recurso));
    } finally {
      this.cargando.set(false);
    }
  }

  nuevo(): void {
    this.abrir(null);
  }

  abrir(fila: Record<string, unknown> | null): void {
    const c = this.config();
    const editando = !!fila;
    const form = construirFormulario(c.campos, fila ?? c.porDefecto?.() ?? {}, editando);
    if (c.alCambiar) {
      for (const [nombre, control] of Object.entries(form.controls)) {
        control.valueChanges.subscribe(() => c.alCambiar!(form, editando, nombre));
      }
    }
    if (!this.puedeEditar()) form.disable();
    this.editando.set(fila);
    this.form.set(form);
    this.dialogo.set(true);
  }

  eliminar(): void {
    const c = this.config();
    const fila = this.editando();
    if (!fila) return;
    const art = c.femenino ? 'la' : 'el';
    this.confirmacion.confirm({
      header: `Eliminar ${c.singular}`,
      message: `¿Eliminar ${art} ${c.singular} de forma permanente? En Auditoría queda una copia con todos sus datos. Si tiene documentos o asignaciones no se podrá eliminar; en ese caso desactívelo.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        await this.api.eliminar(`${c.recurso}/${fila['id']}`);
        this.mensajes.add({
          severity: 'success',
          summary: 'Eliminado',
          detail: `Se eliminó ${art} ${c.singular}.`,
        });
        this.dialogo.set(false);
        await Promise.all([
          this.cargar(),
          c.invalidar ? this.maestros.invalidar(c.invalidar) : null,
        ]);
      },
    });
  }

  async guardar(): Promise<void> {
    const form = this.form();
    const c = this.config();
    if (!form) return;
    if (form.invalid) {
      form.markAllAsTouched();
      this.mensajes.add({
        severity: 'warn',
        summary: 'Revise los datos',
        detail: 'Hay campos obligatorios o con errores.',
      });
      return;
    }
    this.guardando.set(true);
    try {
      const entrada = aEntrada(c.campos, form);
      const fila = this.editando();
      if (fila) await this.api.put(`${c.recurso}/${fila['id']}`, entrada);
      else await this.api.post(c.recurso, entrada);
      this.mensajes.add({
        severity: 'success',
        summary: 'Guardado',
        detail: fila
          ? `Se actualizó ${c.femenino ? 'la' : 'el'} ${c.singular}.`
          : `Se creó ${c.femenino ? 'la' : 'el'} ${c.singular}.`,
      });
      this.dialogo.set(false);
      await Promise.all([this.cargar(), c.invalidar ? this.maestros.invalidar(c.invalidar) : null]);
    } finally {
      this.guardando.set(false);
    }
  }
}
