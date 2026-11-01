import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Listbox } from 'primeng/listbox';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { CATALOGOS, type CatalogoItemDto, type CatalogoMeta } from '@nexustrack/shared';
import { ApiService } from '../../nucleo/api.service';
import { DatosMaestrosService } from '../../nucleo/datos-maestros.service';
import { TablaDatos, type ColumnaTabla } from '../../compartido/tabla/tabla-datos';

@Component({
  selector: 'nt-catalogos',
  imports: [TablaDatos, FormsModule, Listbox, Button, Dialog, InputText, InputNumber, ToggleSwitch],
  template: `
    <div class="nt-encabezado">
      <div>
        <h1>Catálogos</h1>
        <p>
          Listas maestras que alimentan los desplegables (hoja BaseDatos). Un valor en uso no se
          borra: se desactiva.
        </p>
      </div>
    </div>
    <div class="disposicion">
      <p-listbox
        [options]="listas()"
        [ngModel]="tipo()"
        (ngModelChange)="tipo.set($event ?? tipo())"
        optionLabel="etiqueta"
        optionValue="tipo"
        [listStyle]="{ 'max-height': '70vh' }"
        ariaLabel="Catálogos"
      >
        <ng-template #item let-l>
          <div class="nt-fila" style="width: 100%">
            <span>{{ l.etiqueta }}</span>
            <span class="nt-opcion-detalle">{{ l.cantidad }}</span>
          </div>
        </ng-template>
      </p-listbox>
      <div>
        <nt-tabla
          [filas]="items()"
          [columnas]="columnas"
          [titulo]="meta().titulo"
          [claveEstado]="'catalogo'"
          [cargando]="cargando()"
          (seleccionar)="abrir($event)"
        >
          <p-button
            barra
            [label]="'Nuevo valor'"
            icon="pi pi-plus"
            size="small"
            (onClick)="abrir(null)"
            [disabled]="meta().sistema"
          />
        </nt-tabla>
        @if (meta().sistema) {
          <p class="nt-tenue nota">
            Este catálogo lo usa la lógica del sistema: se pueden renombrar, reordenar o desactivar
            sus valores, pero no crear nuevos.
          </p>
        }
      </div>
    </div>

    <p-dialog
      [header]="editando() ? 'Editar valor' : 'Nuevo valor en ' + meta().titulo"
      [(visible)]="dialogo"
      [modal]="true"
      [draggable]="false"
      [style]="{ width: '28rem', maxWidth: '96vw' }"
    >
      <div class="nt-grilla" style="grid-template-columns: 1fr">
        <div class="nt-campo">
          <label for="cat-valor" class="requerido">Valor</label>
          <input
            pInputText
            id="cat-valor"
            [(ngModel)]="valor"
            maxlength="120"
            style="text-transform: uppercase"
          />
        </div>
        <div class="nt-campo">
          <label for="cat-orden">Orden</label>
          <p-inputnumber inputId="cat-orden" [(ngModel)]="orden" [min]="0" [useGrouping]="false" />
          <small class="nt-ayuda">Posición en las listas desplegables.</small>
        </div>
        <div class="nt-campo">
          <label for="cat-activo">Activo</label>
          <p-toggleswitch inputId="cat-activo" [(ngModel)]="activo" />
        </div>
      </div>
      <ng-template #footer>
        <p-button
          label="Cancelar"
          severity="secondary"
          [text]="true"
          (onClick)="dialogo.set(false)"
        />
        <p-button
          label="Guardar"
          icon="pi pi-check"
          (onClick)="guardar()"
          [loading]="guardando()"
          [disabled]="!valor.trim()"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .disposicion {
      display: grid;
      grid-template-columns: 17rem minmax(0, 1fr);
      gap: 1rem;
      align-items: start;
    }
    .nota {
      font-size: 0.85rem;
      margin-top: 0.75rem;
    }
    @media (max-width: 900px) {
      .disposicion {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class Catalogos implements OnInit {
  private readonly api = inject(ApiService);
  private readonly maestros = inject(DatosMaestrosService);
  private readonly mensajes = inject(MessageService);

  readonly tipo = signal<CatalogoMeta['tipo']>('CIUDAD');
  readonly meta = computed(() => CATALOGOS.find((c) => c.tipo === this.tipo())!);
  readonly listas = computed(() =>
    CATALOGOS.map((c) => ({
      tipo: c.tipo,
      etiqueta: c.titulo,
      cantidad: this.maestros.catalogos().filter((x) => x.tipo === c.tipo).length,
    })),
  );
  readonly items = computed(() => this.maestros.catalogos().filter((c) => c.tipo === this.tipo()));

  readonly columnas: ColumnaTabla[] = [
    { campo: 'orden', titulo: 'Orden', tipo: 'numero', ancho: '6rem' },
    { campo: 'valor', titulo: 'Valor' },
    { campo: 'codigo', titulo: 'Código de sistema', oculta: true },
    { campo: 'activo', titulo: 'Activo', tipo: 'booleano' },
  ];

  readonly dialogo = signal(false);
  readonly guardando = signal(false);
  readonly editando = signal<CatalogoItemDto | null>(null);
  valor = '';
  orden: number | null = null;
  activo = true;

  readonly cargando = signal(true);

  async ngOnInit(): Promise<void> {
    try {
      await this.maestros.invalidar('catalogos');
    } finally {
      this.cargando.set(false);
    }
  }

  abrir(item: CatalogoItemDto | null): void {
    this.editando.set(item);
    this.valor = item?.valor ?? '';
    this.orden = item?.orden ?? null;
    this.activo = item?.activo ?? true;
    this.dialogo.set(true);
  }

  async guardar(): Promise<void> {
    const item = this.editando();
    const entrada = {
      tipo: this.tipo(),
      valor: this.valor.trim().toUpperCase(),
      orden: this.orden ?? undefined,
      activo: this.activo,
    };
    this.guardando.set(true);
    try {
      if (item) await this.api.put(`catalogos/${item.id}`, entrada);
      else await this.api.post('catalogos', entrada);
      this.mensajes.add({
        severity: 'success',
        summary: 'Catálogo actualizado',
        detail: entrada.valor,
      });
      this.dialogo.set(false);
      await this.maestros.invalidar('catalogos');
    } finally {
      this.guardando.set(false);
    }
  }
}
