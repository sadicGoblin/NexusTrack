import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Textarea } from 'primeng/textarea';
import type { Estado } from '@nexustrack/shared';
import { ApiService } from '../../nucleo/api.service';
import { CorrelativoPipe } from '../../nucleo/pipes';
import { SesionService } from '../../nucleo/sesion.service';
import { EstadoTag } from '../estado-tag';

/**
 * Encabezado de un documento: título, número, estado y acciones comunes (guardar, PDF, Excel,
 * anular). Las acciones propias del documento se proyectan como contenido.
 */
@Component({
  selector: 'nt-barra-documento',
  imports: [Button, Dialog, FormsModule, Textarea, RouterLink, EstadoTag, CorrelativoPipe],
  template: `
    <div class="nt-encabezado">
      <div>
        <a class="volver" [routerLink]="volver()"
          ><i class="pi pi-arrow-left"></i> {{ etiquetaVolver() }}</a
        >
        <h1>
          {{ titulo() }}
          @if (numero()) {
            <span class="numero">N° {{ numero() | correlativo }}</span>
          }
          @if (estado()) {
            <nt-estado [estado]="estado()" />
          }
        </h1>
        @if (subtitulo()) {
          <p>{{ subtitulo() }}</p>
        }
      </div>
      <div class="nt-encabezado-acciones">
        <ng-content />
        @if (numero()) {
          <p-button
            icon="pi pi-file-pdf"
            label="PDF"
            severity="secondary"
            [outlined]="true"
            [loading]="descargando() === 'pdf'"
            (onClick)="descargar('pdf')"
          />
          <p-button
            icon="pi pi-file-excel"
            label="Excel"
            severity="secondary"
            [outlined]="true"
            [loading]="descargando() === 'xlsx'"
            (onClick)="descargar('xlsx')"
          />
          @if (puedeAnular()) {
            <p-button
              icon="pi pi-ban"
              label="Anular"
              severity="danger"
              [outlined]="true"
              (onClick)="dialogo.set(true)"
            />
          }
        }
        @if (editable()) {
          <p-button
            icon="pi pi-check"
            [label]="numero() ? 'Guardar cambios' : 'Emitir'"
            [loading]="guardando()"
            (onClick)="guardar.emit()"
          />
        }
      </div>
    </div>

    <p-dialog
      header="Anular documento"
      [(visible)]="dialogo"
      [modal]="true"
      [draggable]="false"
      [style]="{ width: '30rem', maxWidth: '96vw' }"
    >
      <p style="margin-top: 0">
        El documento queda registrado como anulado y no se puede volver a editar. Indique el motivo:
      </p>
      <textarea
        pTextarea
        [(ngModel)]="motivo"
        rows="3"
        style="width: 100%"
        placeholder="Motivo de anulación"
        aria-label="Motivo de anulación"
      ></textarea>
      <ng-template #footer>
        <p-button
          label="Cancelar"
          severity="secondary"
          [text]="true"
          (onClick)="dialogo.set(false)"
        />
        <p-button
          label="Anular"
          icon="pi pi-ban"
          severity="danger"
          [disabled]="!motivo.trim()"
          (onClick)="confirmarAnulacion()"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .volver {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.82rem;
      text-decoration: none;
      margin-bottom: 0.4rem;
      color: var(--p-text-muted-color);
      &:hover {
        color: var(--p-primary-color);
      }
    }
    h1 {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .numero {
      color: var(--p-primary-color);
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class BarraDocumento {
  private readonly api = inject(ApiService);
  private readonly sesion = inject(SesionService);

  readonly titulo = input.required<string>();
  readonly subtitulo = input<string>('');
  readonly numero = input<number | null>(null);
  readonly estado = input<Estado | null>(null);
  /** Ruta base de la API para PDF y Excel, por ejemplo "ordenes-retiro/5". */
  readonly recurso = input<string>('');
  readonly volver = input.required<string>();
  readonly etiquetaVolver = input('Volver al listado');
  readonly editable = input(false);
  readonly anulable = input(false);
  readonly guardando = input(false);

  readonly guardar = output<void>();
  readonly anular = output<string>();

  readonly puedeAnular = computed(() => this.anulable() && this.sesion.puede('anular'));
  readonly descargando = signal<'pdf' | 'xlsx' | null>(null);
  readonly dialogo = signal(false);
  motivo = '';

  async descargar(formato: 'pdf' | 'xlsx'): Promise<void> {
    this.descargando.set(formato);
    try {
      await this.api.descargar(`${this.recurso()}/${formato}`);
    } finally {
      this.descargando.set(null);
    }
  }

  confirmarAnulacion(): void {
    this.anular.emit(this.motivo.trim());
    this.dialogo.set(false);
    this.motivo = '';
  }
}
