import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import type { ParametroDto } from '@nexustrack/shared';
import { Cargando } from '../../compartido/cargando';
import { ApiService } from '../../nucleo/api.service';
import { DatosMaestrosService } from '../../nucleo/datos-maestros.service';

const GRUPOS: { titulo: string; claves: string[] }[] = [
  {
    titulo: 'Empresa emisora (encabezado de los documentos)',
    claves: [
      'EMPRESA_NOMBRE',
      'EMPRESA_RUT',
      'EMPRESA_DIRECCION',
      'EMPRESA_TELEFONO',
      'EMPRESA_EMAIL',
    ],
  },
  {
    titulo: 'Valores por defecto',
    claves: ['VALOR_LITRO_COMBUSTIBLE', 'CONCEPTO_VALE_DINERO', 'DIAS_ALERTA_VENCIMIENTO'],
  },
];

@Component({
  selector: 'nt-parametros',
  imports: [FormsModule, InputText, Button, Cargando],
  template: `
    <div class="nt-encabezado">
      <div>
        <h1>Parámetros</h1>
        <p>Datos de la empresa emisora y valores por defecto de los formularios.</p>
      </div>
    </div>
    @if (cargando()) {
      <nt-cargando class="bloque" />
    }
    @for (g of grupos; track g.titulo) {
      <section class="nt-tarjeta" [hidden]="cargando()">
        <div class="nt-tarjeta-titulo">
          <h2>{{ g.titulo }}</h2>
        </div>
        @for (p of parametrosDe(g.claves); track p.clave) {
          <div class="parametro" [class.nt-sin-guardar]="valores[p.clave] !== p.valor">
            <div>
              <label [for]="p.clave">{{ p.descripcion }}</label>
              <small class="nt-tenue">{{ p.clave }}</small>
            </div>
            <input pInputText [id]="p.clave" [(ngModel)]="valores[p.clave]" />
            <p-button
              icon="pi pi-check"
              label="Guardar"
              size="small"
              [outlined]="true"
              [disabled]="valores[p.clave] === p.valor"
              [loading]="guardando() === p.clave"
              (onClick)="guardar(p)"
            />
          </div>
        }
      </section>
    }
  `,
  styles: `
    .parametro {
      display: grid;
      grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) auto;
      gap: 1rem;
      align-items: center;
      padding: 0.6rem 0;
      border-bottom: 1px solid var(--p-content-border-color);
      &:last-child {
        border-bottom: none;
      }
      label {
        display: block;
        font-size: 0.9rem;
        font-weight: 500;
      }
      small {
        font-size: 0.72rem;
        font-family: ui-monospace, monospace;
      }
    }
    @media (max-width: 760px) {
      .parametro {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class Parametros implements OnInit {
  private readonly api = inject(ApiService);
  private readonly maestros = inject(DatosMaestrosService);
  private readonly mensajes = inject(MessageService);

  readonly grupos = GRUPOS;
  readonly parametros = signal<ParametroDto[]>([]);
  readonly guardando = signal<string | null>(null);
  readonly cargando = signal(true);
  valores: Record<string, string> = {};

  async ngOnInit(): Promise<void> {
    try {
      const lista = await this.api.get<ParametroDto[]>('parametros');
      this.valores = Object.fromEntries(lista.map((p) => [p.clave, p.valor]));
      this.parametros.set(lista);
    } finally {
      this.cargando.set(false);
    }
  }

  parametrosDe(claves: string[]): ParametroDto[] {
    return claves
      .map((c) => this.parametros().find((p) => p.clave === c))
      .filter((p): p is ParametroDto => !!p);
  }

  async guardar(p: ParametroDto): Promise<void> {
    this.guardando.set(p.clave);
    try {
      const actualizado = await this.api.put<ParametroDto>(`parametros/${p.clave}`, {
        valor: this.valores[p.clave] ?? '',
      });
      this.parametros.update((lista) => lista.map((x) => (x.clave === p.clave ? actualizado : x)));
      this.mensajes.add({
        severity: 'success',
        summary: 'Parámetro guardado',
        detail: p.descripcion,
      });
      void this.maestros.invalidar('parametros');
    } finally {
      this.guardando.set(null);
    }
  }
}
