import { Pipe, type PipeTransform } from '@angular/core';
import {
  formatearFecha,
  formatearNumero,
  formatearPesos,
  formatearPorcentaje,
} from '@nexustrack/shared';

@Pipe({ name: 'fecha' })
export class FechaPipe implements PipeTransform {
  transform(valor: string | null | undefined): string {
    return formatearFecha(valor);
  }
}

@Pipe({ name: 'pesos' })
export class PesosPipe implements PipeTransform {
  transform(valor: number | null | undefined): string {
    return formatearPesos(valor);
  }
}

@Pipe({ name: 'numero' })
export class NumeroPipe implements PipeTransform {
  transform(valor: number | null | undefined, decimales = 0): string {
    return formatearNumero(valor, decimales);
  }
}

@Pipe({ name: 'porcentaje' })
export class PorcentajePipe implements PipeTransform {
  transform(valor: number | null | undefined): string {
    return formatearPorcentaje(valor, 1).replace(',0 %', ' %');
  }
}

@Pipe({ name: 'correlativo' })
export class CorrelativoPipe implements PipeTransform {
  transform(valor: number | null | undefined): string {
    return valor ? String(valor).padStart(6, '0') : '';
  }
}
