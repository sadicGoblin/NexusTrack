import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatearFecha, type ResumenRetiroDto } from '@nexustrack/shared';
import { CorrelativoPipe } from '../../nucleo/pipes';
import { EstadoTag } from '../estado-tag';
import { Dato } from './dato';

/** Datos de la orden de retiro que heredan los documentos hijos. */
@Component({
  selector: 'nt-resumen-retiro',
  imports: [Dato, EstadoTag, RouterLink, CorrelativoPipe],
  template: `
    @let r = retiro();
    <div class="nt-tarjeta">
      <div class="nt-tarjeta-titulo">
        <h2>
          Orden de retiro
          <a [routerLink]="['/operacion/ordenes-retiro', r.id]">N° {{ r.numero | correlativo }}</a>
        </h2>
        <nt-estado [estado]="r.estado" />
      </div>
      <div class="nt-grilla">
        <nt-dato etiqueta="Fecha orden de retiro" [valor]="f(r.fecha)" />
        <nt-dato etiqueta="Cliente" [valor]="r.cliente" />
        <nt-dato etiqueta="Trazabilidad" [valor]="r.trazabilidad" />
        <nt-dato etiqueta="Origen → destino" [valor]="r.origen + ' → ' + r.destino" />
        <nt-dato etiqueta="Conductor" [valor]="r.conductor" />
        <nt-dato etiqueta="RUT conductor" [valor]="r.conductorRut" />
        <nt-dato etiqueta="Empresa" [valor]="r.empresa" />
        <nt-dato
          etiqueta="Camión / remolque"
          [valor]="r.camion + (r.remolque ? ' / ' + r.remolque : '')"
        />
        @if (completo()) {
          <nt-dato etiqueta="Puerto de embarque" [valor]="r.puertoEmbarque" />
          <nt-dato
            etiqueta="Embarque"
            [valor]="f(r.fechaEmbarque) + (r.horaEmbarque ? ' ' + r.horaEmbarque : '')"
          />
          <nt-dato etiqueta="Depósito de retiro" [valor]="r.depositoRetiro" />
          <nt-dato etiqueta="Depósito de entrega" [valor]="r.depositoEntrega" />
          <nt-dato etiqueta="Packing de entrega" [valor]="r.packingEntrega" />
          <nt-dato etiqueta="Packing de carga" [valor]="r.packingCarga" />
          <nt-dato
            etiqueta="Carga programada"
            [valor]="f(r.fechaCarga) + (r.horaCarga ? ' ' + r.horaCarga : '')"
          />
          <nt-dato etiqueta="Tipo remolque" [valor]="r.tipoRemolque" />
        }
      </div>
    </div>
  `,
})
export class ResumenRetiro {
  readonly retiro = input.required<ResumenRetiroDto>();
  /** Muestra también embarque, depósitos y packings (orden de carga). */
  readonly completo = input(false);
  f = formatearFecha;
}
