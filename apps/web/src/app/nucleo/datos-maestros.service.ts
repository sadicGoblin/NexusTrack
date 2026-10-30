import { computed, inject, Injectable, signal, type WritableSignal } from '@angular/core';
import type {
  CatalogoItemDto,
  ClienteDto,
  ConductorDto,
  EmpresaDto,
  MovilDto,
  PackingDto,
  ParametroDto,
  TipoCatalogo,
} from '@nexustrack/shared';
import { ApiService } from './api.service';

export type Conjunto =
  'catalogos' | 'empresas' | 'clientes' | 'packings' | 'moviles' | 'conductores' | 'parametros';

export interface Opcion<T = number> {
  label: string;
  value: T;
  /** Texto secundario (por ejemplo, el tipo de móvil o la empresa). */
  detalle?: string;
  inactivo?: boolean;
  /** Destaca el detalle como advertencia (por ejemplo, una tarifa vencida). */
  alerta?: boolean;
}

/**
 * Caché de datos maestros para llenar listas desplegables. Se carga bajo demanda y se
 * invalida cuando un mantenedor guarda cambios.
 */
@Injectable({ providedIn: 'root' })
export class DatosMaestrosService {
  private readonly api = inject(ApiService);

  readonly catalogos = signal<CatalogoItemDto[]>([]);
  readonly empresas = signal<EmpresaDto[]>([]);
  readonly clientes = signal<ClienteDto[]>([]);
  readonly packings = signal<PackingDto[]>([]);
  readonly moviles = signal<MovilDto[]>([]);
  readonly conductores = signal<ConductorDto[]>([]);
  readonly parametros = signal<ParametroDto[]>([]);

  /** Conjunto de datos → señal donde se guarda. La ruta de la API coincide con el nombre. */
  private readonly fuentes: Record<Conjunto, WritableSignal<unknown[]>> = {
    catalogos: this.catalogos as WritableSignal<unknown[]>,
    empresas: this.empresas as WritableSignal<unknown[]>,
    clientes: this.clientes as WritableSignal<unknown[]>,
    packings: this.packings as WritableSignal<unknown[]>,
    moviles: this.moviles as WritableSignal<unknown[]>,
    conductores: this.conductores as WritableSignal<unknown[]>,
    parametros: this.parametros as WritableSignal<unknown[]>,
  };
  private readonly cargas = new Map<Conjunto, Promise<void>>();

  /** Carga (una vez) los conjuntos indicados. */
  async asegurar(...conjuntos: Conjunto[]) {
    await Promise.all(conjuntos.map((c) => this.cargar(c)));
  }

  /** Fuerza recargar un conjunto (después de crear o editar). */
  invalidar(conjunto: Conjunto) {
    this.cargas.delete(conjunto);
    return this.cargar(conjunto);
  }

  private cargar(c: Conjunto): Promise<void> {
    if (!this.cargas.has(c)) {
      const p = this.api
        .get<unknown[]>(c)
        .then((datos) => this.fuentes[c].set(datos))
        .catch((e) => {
          this.cargas.delete(c);
          throw e;
        });
      this.cargas.set(c, p);
    }
    return this.cargas.get(c)!;
  }

  parametro(clave: string): string {
    return this.parametros().find((p) => p.clave === clave)?.valor ?? '';
  }

  /** Opciones activas de un catálogo, más el valor actual aunque esté inactivo. */
  opcionesCatalogo(tipo: TipoCatalogo, incluirId?: number | null): Opcion[] {
    return this.catalogos()
      .filter((c) => c.tipo === tipo && (c.activo || c.id === incluirId))
      .map((c) => ({ label: c.valor, value: c.id, inactivo: !c.activo }));
  }

  readonly opcionesEmpresas = computed<Opcion[]>(() =>
    this.empresas().map((e) => ({
      label: e.razonSocial,
      value: e.id,
      detalle: e.categoria,
      inactivo: !e.activo,
    })),
  );

  readonly opcionesClientes = computed<Opcion[]>(() =>
    this.clientes().map((c) => ({
      label: c.nombre,
      value: c.id,
      detalle: c.rut,
      inactivo: !c.activo,
    })),
  );

  readonly opcionesConductores = computed<Opcion[]>(() =>
    this.conductores().map((c) => ({
      label: c.nombre,
      value: c.id,
      detalle: c.empresa,
      inactivo: !c.activo,
    })),
  );

  opcionesPackings(clienteId?: number | null): Opcion[] {
    return this.packings()
      .filter((p) => !clienteId || p.clienteId === clienteId)
      .map((p) => ({ label: p.nombre, value: p.id, detalle: p.cliente, inactivo: !p.activo }));
  }

  opcionesMoviles(codigos: readonly string[], empresaId?: number | null): Opcion[] {
    return this.moviles()
      .filter(
        (m) =>
          m.tipoCodigo &&
          codigos.includes(m.tipoCodigo) &&
          (!empresaId || m.empresaId === empresaId),
      )
      .map((m) => ({
        label: m.patente,
        value: m.id,
        detalle: `${m.tipo} · ${m.empresa}`,
        inactivo: !m.activo,
      }));
  }
}
