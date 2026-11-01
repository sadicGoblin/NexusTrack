import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { saldoAntesDe, sentidoSaldo, type DetalleCuentaDto } from '@nexustrack/shared';
import { ApiService } from '../../nucleo/api.service';
import { CorrelativoPipe, PesosPipe } from '../../nucleo/pipes';

/**
 * Cuenta del conductor dentro de un documento. En una rendición muestra cómo el flete mueve el
 * saldo (anterior + anticipos − gastos); en un vale de dinero, el saldo y los anticipos que el
 * conductor todavía no rinde, para decidir cuánto entregarle.
 */
@Component({
  selector: 'nt-cuenta-conductor',
  imports: [RouterLink, PesosPipe, CorrelativoPipe],
  template: `
    @if (cuenta(); as c) {
      <section class="nt-tarjeta">
        <div class="nt-tarjeta-titulo">
          <h2>Cuenta del conductor</h2>
          <a [routerLink]="['/operacion/cuentas-conductores', c.conductorId]" class="ver"
            >Ver cuenta de {{ c.conductor }} <i class="pi pi-arrow-right"></i
          ></a>
        </div>

        <div class="lineas">
          @if (modo() === 'rendicion') {
            <div class="linea">
              <span>Saldo anterior</span>
              <span class="sentido" [attr.data-sentido]="signo(anterior())">{{
                sentido(anterior())
              }}</span>
              <strong>{{ anterior() | pesos }}</strong>
            </div>
            <div class="linea">
              <span
                >Anticipos de este flete
                @if (vales().length) {
                  <small class="nt-tenue">(vale {{ numerosVales() }})</small>
                }
              </span>
              <span></span>
              <strong>+ {{ anticipos() | pesos }}</strong>
            </div>
            <div class="linea">
              <span>Gastos de esta rendición</span>
              <span></span>
              <strong>− {{ totalRendicion() | pesos }}</strong>
            </div>
            <div class="linea total">
              <span>Saldo de la cuenta</span>
              <span class="sentido" [attr.data-sentido]="signo(nuevo())">{{
                sentido(nuevo())
              }}</span>
              <strong>{{ nuevo() | pesos }}</strong>
            </div>
          } @else {
            <div class="linea total">
              <span>Saldo de la cuenta <small class="nt-tenue">(fletes rendidos)</small></span>
              <span class="sentido" [attr.data-sentido]="signo(c.saldo)">{{
                sentido(c.saldo)
              }}</span>
              <strong>{{ c.saldo | pesos }}</strong>
            </div>
            <div class="linea">
              <span
                >Anticipos de esta orden
                @if (vales().length) {
                  <small class="nt-tenue">(vale {{ numerosVales() }})</small>
                }
              </span>
              <span></span>
              <strong>{{ anticipos() | pesos }}</strong>
            </div>
            <div class="linea">
              <span
                >Anticipos sin rendir de otros fletes
                @if (otrosPorRendir().length) {
                  <small class="nt-tenue"
                    >(orden
                    @for (f of otrosPorRendir(); track f.ordenRetiroId; let ultimo = $last) {
                      <a [routerLink]="['/operacion/ordenes-retiro', f.ordenRetiroId]"
                        >N° {{ f.ordenRetiroNumero | correlativo }}</a
                      >{{ ultimo ? '' : ', ' }}
                    }
                    )</small
                  >
                }
              </span>
              <span></span>
              <strong>{{ totalOtrosPorRendir() | pesos }}</strong>
            </div>
          }
        </div>
        <p class="ayuda">
          <strong>A favor (positivo):</strong> le sobró anticipo y lo usa en el próximo flete.
          <strong>En contra (negativo):</strong> gastó más de lo anticipado y puso dinero propio.
        </p>
      </section>
    }
  `,
  styles: `
    .ver {
      font-size: 0.85rem;
      text-decoration: none;
      color: var(--p-primary-color);
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      i {
        font-size: 0.75rem;
      }
    }
    .lineas {
      max-width: 40rem;
      margin-left: auto;
    }
    .linea {
      display: grid;
      grid-template-columns: 1fr auto 9rem;
      align-items: baseline;
      gap: 0.75rem;
      padding: 0.45rem 0;
      border-bottom: 1px solid var(--p-content-border-color);
      strong {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
    }
    .linea.total {
      border-bottom: none;
      font-size: 1.05rem;
      strong {
        font-size: 1.3rem;
      }
    }
    .sentido {
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      white-space: nowrap;
      background: var(--p-content-hover-background);
      color: var(--p-text-muted-color);
    }
    .sentido[data-sentido='favor'] {
      background: color-mix(in srgb, var(--p-primary-color) 14%, transparent);
      color: var(--p-primary-color);
    }
    .sentido[data-sentido='contra'] {
      background: color-mix(in srgb, var(--nt-alerta) 16%, transparent);
      color: var(--nt-alerta);
    }
    .ayuda {
      margin: 0.75rem 0 0;
      font-size: 0.8rem;
      color: var(--p-text-muted-color);
      text-align: right;
    }
    @media (max-width: 640px) {
      .linea {
        grid-template-columns: 1fr auto;
        .sentido {
          grid-row: 2;
        }
      }
    }
  `,
})
export class CuentaConductor {
  private readonly api = inject(ApiService);

  readonly conductorId = input.required<number>();
  readonly ordenRetiroId = input.required<number>();
  readonly modo = input<'rendicion' | 'anticipo'>('rendicion');
  /** Total de la rendición en pantalla (cambia mientras se edita). */
  readonly totalRendicion = input(0);
  /** Cualquier valor que cambie al guardar el documento, para volver a leer la cuenta. */
  readonly recargar = input<unknown>(null);

  readonly cuenta = signal<DetalleCuentaDto | null>(null);

  private readonly flete = computed(() =>
    this.cuenta()?.fletes.find((f) => f.ordenRetiroId === this.ordenRetiroId()),
  );
  readonly vales = computed(() => this.flete()?.vales ?? []);
  readonly numerosVales = computed(() =>
    this.vales()
      .map((v) => `N° ${String(v.numero).padStart(6, '0')}`)
      .join(', '),
  );
  readonly anticipos = computed(() => this.flete()?.anticipos ?? 0);
  readonly anterior = computed(() =>
    saldoAntesDe(this.cuenta()?.fletes ?? [], this.ordenRetiroId()),
  );
  readonly nuevo = computed(() => this.anterior() + this.anticipos() - this.totalRendicion());
  readonly otrosPorRendir = computed(() =>
    (this.cuenta()?.fletes ?? []).filter(
      (f) => f.rendido === null && f.anticipos > 0 && f.ordenRetiroId !== this.ordenRetiroId(),
    ),
  );
  readonly totalOtrosPorRendir = computed(() =>
    this.otrosPorRendir().reduce((s, f) => s + f.anticipos, 0),
  );

  constructor() {
    effect(() => {
      const id = this.conductorId();
      this.recargar();
      untracked(() => void this.cargar(id));
    });
  }

  private async cargar(id: number): Promise<void> {
    this.cuenta.set(await this.api.get<DetalleCuentaDto>(`cuentas-conductores/${id}`));
  }

  protected sentido(saldo: number): string {
    return sentidoSaldo(saldo);
  }

  protected signo(saldo: number): 'favor' | 'contra' | 'cero' {
    return saldo > 0 ? 'favor' : saldo < 0 ? 'contra' : 'cero';
  }
}
