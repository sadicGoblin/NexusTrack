import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  formatearRut,
  sentidoSaldo,
  TIPO_RENDICION_ETIQUETA,
  type CuentaConductorDto,
  type DetalleCuentaDto,
  type FleteCuentaDto,
} from '@nexustrack/shared';
import { ApiService } from '../../nucleo/api.service';
import { FechaPipe, PesosPipe } from '../../nucleo/pipes';
import { TablaDatos, type ColumnaTabla } from '../../compartido/tabla/tabla-datos';

const AYUDA =
  'A favor (positivo): le sobró anticipo y lo usa en el próximo flete. En contra (negativo): gastó más de lo anticipado y puso dinero propio.';

const ESTILOS = `
  .resumen {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .cifra {
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: var(--nt-radio);
    box-shadow: var(--nt-tarjeta-sombra);
    padding: 1rem 1.25rem;
    span {
      display: block;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--p-text-muted-color);
    }
    strong {
      display: block;
      font-size: 1.5rem;
      margin-top: 0.25rem;
      font-variant-numeric: tabular-nums;
    }
    small {
      color: var(--p-text-muted-color);
    }
  }
  .favor strong {
    color: var(--p-primary-color);
  }
  .contra strong {
    color: var(--nt-alerta);
  }
  .ayuda {
    font-size: 0.82rem;
    color: var(--p-text-muted-color);
    margin: 0 0 1rem;
  }
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
`;

/** Saldo de cada conductor: anticipos entregados contra gastos rendidos. */
@Component({
  selector: 'nt-cuentas-conductores',
  imports: [TablaDatos, PesosPipe],
  template: `
    <div class="nt-encabezado">
      <div>
        <h1>Cuentas de conductores</h1>
        <p>
          Anticipos (vales de dinero) contra lo rendido, flete a flete. Aparecen los conductores con
          anticipos o rendiciones.
        </p>
      </div>
    </div>

    <div class="resumen">
      <div class="cifra favor">
        <span>A favor de conductores</span>
        <strong>{{ totales().favor | pesos }}</strong>
        <small>{{ plural(totales().conFavor, 'conductor', 'conductores') }}</small>
      </div>
      <div class="cifra contra">
        <span>En contra de conductores</span>
        <strong>{{ totales().contra | pesos }}</strong>
        <small>{{ plural(totales().conContra, 'conductor', 'conductores') }}</small>
      </div>
      <div class="cifra">
        <span>Anticipos por rendir</span>
        <strong>{{ totales().porRendir | pesos }}</strong>
        <small>{{ plural(totales().fletes, 'flete', 'fletes') }} sin rendición</small>
      </div>
    </div>
    <p class="ayuda">{{ ayuda }}</p>

    <nt-tabla
      [filas]="filas()"
      [columnas]="columnas"
      titulo="Cuentas de conductores"
      [cargando]="cargando()"
      claveEstado="cuentas-conductores"
      (seleccionar)="abrir($event)"
    />
  `,
  styles: ESTILOS,
})
export class CuentasConductores {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly ayuda = AYUDA;
  readonly plural = plural;
  readonly cuentas = signal<CuentaConductorDto[]>([]);
  readonly cargando = signal(true);

  readonly filas = computed(() =>
    this.cuentas().map((c) => ({
      ...c,
      rut: formatearRut(c.rut),
      sentido: capitalizar(sentidoSaldo(c.saldo)),
    })),
  );
  readonly totales = computed(() => {
    const c = this.cuentas();
    const favor = c.filter((x) => x.saldo > 0);
    const contra = c.filter((x) => x.saldo < 0);
    return {
      favor: favor.reduce((s, x) => s + x.saldo, 0),
      conFavor: favor.length,
      contra: contra.reduce((s, x) => s + x.saldo, 0),
      conContra: contra.length,
      porRendir: c.reduce((s, x) => s + x.porRendir, 0),
      fletes: c.reduce((s, x) => s + x.fletesPorRendir, 0),
    };
  });

  readonly columnas: ColumnaTabla[] = [
    { campo: 'conductor', titulo: 'Conductor', ancho: '16rem' },
    { campo: 'rut', titulo: 'RUT', ancho: '8.5rem' },
    { campo: 'empresa', titulo: 'Empresa', filtro: 'lista', ancho: '14rem' },
    { campo: 'saldo', titulo: 'Saldo', tipo: 'pesos' },
    { campo: 'sentido', titulo: 'Sentido', filtro: 'lista' },
    { campo: 'porRendir', titulo: 'Anticipos por rendir', tipo: 'pesos' },
    { campo: 'fletesPorRendir', titulo: 'Fletes por rendir', tipo: 'numero' },
    { campo: 'ultimoMovimiento', titulo: 'Último movimiento', tipo: 'fecha' },
  ];

  constructor() {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      this.cuentas.set(await this.api.get<CuentaConductorDto[]>('cuentas-conductores'));
    } finally {
      this.cargando.set(false);
    }
  }

  abrir(fila: CuentaConductorDto): void {
    void this.router.navigate(['/operacion/cuentas-conductores', fila.conductorId]);
  }
}

/** Movimientos de la cuenta de un conductor, flete a flete. */
@Component({
  selector: 'nt-cuenta-de-conductor',
  imports: [TablaDatos, RouterLink, PesosPipe, FechaPipe],
  template: `
    <div class="nt-encabezado">
      <div>
        <a class="volver" routerLink="/operacion/cuentas-conductores"
          ><i class="pi pi-arrow-left"></i> Volver a las cuentas</a
        >
        <h1>{{ cuenta()?.conductor ?? 'Cuenta del conductor' }}</h1>
        @if (cuenta(); as c) {
          <p>RUT {{ rut() }} · {{ c.empresa }}</p>
        }
      </div>
    </div>

    @if (cuenta(); as c) {
      <div class="resumen">
        <div class="cifra" [class.favor]="c.saldo > 0" [class.contra]="c.saldo < 0">
          <span>Saldo · {{ sentido() }}</span>
          <strong>{{ c.saldo | pesos }}</strong>
          <small>Suma de los fletes rendidos</small>
        </div>
        <div class="cifra">
          <span>Anticipos por rendir</span>
          <strong>{{ c.porRendir | pesos }}</strong>
          <small>{{ plural(c.fletesPorRendir, 'flete', 'fletes') }} sin rendición</small>
        </div>
        <div class="cifra">
          <span>Último movimiento</span>
          <strong>{{ (c.ultimoMovimiento | fecha) || '—' }}</strong>
          <small>Vale o rendición más reciente</small>
        </div>
      </div>
      <p class="ayuda">
        Cada flete rendido deja un resultado = anticipos − gastos rendidos. Positivo: a favor del
        conductor; negativo: en contra. El saldo se arrastra de un flete a otro.
      </p>
    }

    <nt-tabla
      [filas]="filas()"
      [columnas]="columnas"
      [titulo]="'Cuenta de ' + (cuenta()?.conductor ?? 'conductor')"
      [cargando]="cargando()"
      claveEstado="cuenta-conductor"
      (seleccionar)="abrir($event)"
    />
  `,
  styles: ESTILOS,
})
export class CuentaDeConductor {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();
  readonly cuenta = signal<DetalleCuentaDto | null>(null);
  readonly cargando = signal(true);

  readonly rut = computed(() => formatearRut(this.cuenta()?.rut ?? ''));
  readonly sentido = computed(() => sentidoSaldo(this.cuenta()?.saldo ?? 0));
  readonly filas = computed(() =>
    (this.cuenta()?.fletes ?? []).map((f) => ({
      ...f,
      ruta: `${f.origen} → ${f.destino}`,
      tipo: TIPO_RENDICION_ETIQUETA[f.tipo],
      numerosVales: f.vales.map((v) => String(v.numero).padStart(6, '0')).join(', '),
      estado: f.rendido === null ? 'Por rendir' : 'Rendido',
    })),
  );

  readonly columnas: ColumnaTabla[] = [
    { campo: 'tipo', titulo: 'Tipo', filtro: 'lista' },
    { campo: 'ordenRetiroNumero', titulo: 'Orden de retiro', tipo: 'correlativo' },
    { campo: 'fecha', titulo: 'Fecha', tipo: 'fecha' },
    { campo: 'cliente', titulo: 'Cliente', filtro: 'lista' },
    { campo: 'ruta', titulo: 'Ruta', ancho: '14rem' },
    { campo: 'numerosVales', titulo: 'Vales N°' },
    { campo: 'anticipos', titulo: 'Anticipos', tipo: 'pesos' },
    { campo: 'rendicionNumero', titulo: 'Rendición', tipo: 'correlativo' },
    { campo: 'fechaRendicion', titulo: 'Fecha rendición', tipo: 'fecha' },
    { campo: 'rendido', titulo: 'Rendido', tipo: 'pesos' },
    { campo: 'resultado', titulo: 'Resultado', tipo: 'pesos' },
    { campo: 'saldo', titulo: 'Saldo', tipo: 'pesos' },
    { campo: 'estado', titulo: 'Estado', filtro: 'lista' },
  ];

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.cargar(id));
    });
  }

  private async cargar(id: string): Promise<void> {
    this.cargando.set(true);
    try {
      this.cuenta.set(await this.api.get<DetalleCuentaDto>(`cuentas-conductores/${id}`));
    } finally {
      this.cargando.set(false);
    }
  }

  readonly plural = plural;

  /** Un flete abre su orden de retiro; una estadía, su rendición. */
  abrir(fila: FleteCuentaDto): void {
    void this.router.navigate(
      fila.ordenRetiroId
        ? ['/operacion/ordenes-retiro', fila.ordenRetiroId]
        : ['/operacion/estadias', fila.rendicionId],
    );
  }
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
