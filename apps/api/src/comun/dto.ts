import type { AnularInput, FiltroFechas } from '@nexustrack/shared';
import { Fecha, Texto } from './validacion.js';

export class AnularDto implements AnularInput {
  @Texto('Motivo de anulación', { max: 300 })
  motivo!: string;
}

export class FiltroFechasDto implements FiltroFechas {
  @Fecha('Desde', { opcional: true })
  desde?: string;

  @Fecha('Hasta', { opcional: true })
  hasta?: string;
}
