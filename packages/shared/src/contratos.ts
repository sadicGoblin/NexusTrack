/**
 * Contratos de la API REST: formas de entrada (Input) y de salida (Dto).
 * Fechas siempre como texto AAAA-MM-DD; horas como HH:mm; montos en pesos enteros.
 */
import type { TipoCatalogo, CodigoTipoMovil } from './catalogos.js';
import type { Rol, TipoConductor, EstadoOrdenRetiro, EstadoOrdenCarga, EstadoDocumento } from './enums.js';

type Fecha = string;
type Nullable<T> = T | null;

// ───────────────────────────── Acceso ─────────────────────────────

export interface LoginInput {
  email: string;
  password: string;
}

export interface UsuarioSesion {
  id: number;
  email: string;
  nombre: string;
  rol: Rol;
}

export interface SesionDto {
  accessToken: string;
  /** Segundos de validez del accessToken. */
  expiraEn: number;
  usuario: UsuarioSesion;
}

export interface CambiarPasswordInput {
  actual: string;
  nueva: string;
}

export interface UsuarioDto extends UsuarioSesion {
  activo: boolean;
  ultimoAcceso: Nullable<string>;
  creadoEn: string;
}

export interface UsuarioInput {
  email: string;
  nombre: string;
  rol: Rol;
  activo?: boolean;
  /** Obligatoria al crear; opcional al editar (si viene, se reemplaza). */
  password?: string;
}

// ───────────────────────────── Sistema ─────────────────────────────

export interface ParametroDto {
  clave: string;
  valor: string;
  descripcion: string;
}

export interface ParametroInput {
  valor: string;
}

export interface AuditoriaDto {
  id: number;
  entidad: string;
  entidadId: number;
  /** Cómo se reconoce el registro: "N° 000012" en documentos, patente, nombre, etc. */
  referencia: Nullable<string>;
  /** El registro ya no existe porque se eliminó. */
  eliminado: boolean;
  accion: string;
  usuario: Nullable<string>;
  fecha: string;
  cambios: unknown;
}

export interface AnularInput {
  motivo: string;
}

// ───────────────────────────── Catálogos ─────────────────────────────

export interface CatalogoItemDto {
  id: number;
  tipo: TipoCatalogo;
  valor: string;
  codigo: Nullable<string>;
  orden: number;
  activo: boolean;
}

export interface CatalogoItemInput {
  tipo: TipoCatalogo;
  valor: string;
  orden?: number;
  activo?: boolean;
}

// ───────────────────────────── Mantenedores ─────────────────────────────

export interface EmpresaDto {
  id: number;
  rut: string;
  razonSocial: string;
  activo: boolean;
  propietario: Nullable<string>;
  fono: Nullable<string>;
  email: Nullable<string>;
  categoriaId: number;
  categoria: string;
  categoriaCodigo: Nullable<string>;
}

export interface EmpresaInput {
  rut: string;
  razonSocial: string;
  activo?: boolean;
  propietario?: Nullable<string>;
  fono?: Nullable<string>;
  email?: Nullable<string>;
  categoriaId: number;
}

export interface ClienteDto {
  id: number;
  rut: string;
  nombre: string;
  activo: boolean;
  giro: Nullable<string>;
  direccion: Nullable<string>;
  contactoOperaciones: Nullable<string>;
  contactoAdministrativo: Nullable<string>;
  fono: Nullable<string>;
  email: Nullable<string>;
}

export interface ClienteInput {
  rut: string;
  nombre: string;
  activo?: boolean;
  giro?: Nullable<string>;
  direccion?: Nullable<string>;
  contactoOperaciones?: Nullable<string>;
  contactoAdministrativo?: Nullable<string>;
  fono?: Nullable<string>;
  email?: Nullable<string>;
}

export interface PackingDto {
  id: number;
  codigo: string;
  nombre: string;
  ubicacion: Nullable<string>;
  activo: boolean;
  clienteId: number;
  cliente: string;
}

export interface PackingInput {
  /** Si se omite, el sistema propone PK-001, PK-002, ... */
  codigo?: Nullable<string>;
  nombre: string;
  ubicacion?: Nullable<string>;
  activo?: boolean;
  clienteId: number;
}

export interface MovilDto {
  id: number;
  patente: string;
  marca: Nullable<string>;
  modelo: Nullable<string>;
  anio: Nullable<number>;
  color: Nullable<string>;
  numeroMotor: Nullable<string>;
  numeroChasis: Nullable<string>;
  tipoId: number;
  tipo: string;
  tipoCodigo: Nullable<CodigoTipoMovil>;
  activo: boolean;
  empresaId: number;
  empresa: string;
  /** Derivado de la categoría de la empresa (SOCIO, FLETERO, EXTERNO). */
  tipoEmpresa: string;
  vencRevisionTecnica: Nullable<Fecha>;
  vencPermisoCirculacion: Nullable<Fecha>;
  vencSeguro: Nullable<Fecha>;
}

export interface MovilInput {
  patente: string;
  marca?: Nullable<string>;
  modelo?: Nullable<string>;
  anio?: Nullable<number>;
  color?: Nullable<string>;
  numeroMotor?: Nullable<string>;
  numeroChasis?: Nullable<string>;
  tipoId: number;
  activo?: boolean;
  empresaId: number;
  vencRevisionTecnica?: Nullable<Fecha>;
  vencPermisoCirculacion?: Nullable<Fecha>;
  vencSeguro?: Nullable<Fecha>;
}

export interface ConductorDto {
  id: number;
  rut: string;
  nombre: string;
  activo: boolean;
  tipo: TipoConductor;
  empresaId: number;
  empresa: string;
  comision: Nullable<number>;
  numeroLicencia: Nullable<string>;
  vencLicencia: Nullable<Fecha>;
  fechaIngreso: Nullable<Fecha>;
  terminoContrato: Nullable<Fecha>;
  direccion: Nullable<string>;
  telefono: Nullable<string>;
  numeroCuenta: Nullable<string>;
  banco: Nullable<string>;
}

export interface ConductorInput {
  rut: string;
  nombre: string;
  activo?: boolean;
  tipo: TipoConductor;
  empresaId: number;
  comision?: Nullable<number>;
  numeroLicencia?: Nullable<string>;
  vencLicencia?: Nullable<Fecha>;
  fechaIngreso?: Nullable<Fecha>;
  terminoContrato?: Nullable<Fecha>;
  direccion?: Nullable<string>;
  telefono?: Nullable<string>;
  numeroCuenta?: Nullable<string>;
  banco?: Nullable<string>;
}

export interface AsignacionDto {
  id: number;
  empresaId: number;
  empresa: string;
  camionId: number;
  camion: string;
  camionTipo: string;
  conductorId: Nullable<number>;
  conductor: Nullable<string>;
  chasisId: Nullable<number>;
  chasis: Nullable<string>;
  thermoId: Nullable<number>;
  thermo: Nullable<string>;
  plataformaId: Nullable<number>;
  plataforma: Nullable<string>;
  fechaAsignacion: Fecha;
  fechaTermino: Nullable<Fecha>;
  vigente: boolean;
}

/** Fila del tablero: un camión con su asignación vigente (si tiene). */
export interface TableroAsignacionDto {
  camionId: number;
  camion: string;
  camionTipo: string;
  empresaId: number;
  empresa: string;
  asignacion: Nullable<AsignacionDto>;
}

export interface AsignacionInput {
  camionId: number;
  conductorId?: Nullable<number>;
  chasisId?: Nullable<number>;
  thermoId?: Nullable<number>;
  plataformaId?: Nullable<number>;
  fechaAsignacion: Fecha;
}

/** Respuesta del autocompletado de la orden de retiro. */
export interface SugerenciaAsignacionDto {
  empresaId: Nullable<number>;
  camionId: Nullable<number>;
  remolqueId: Nullable<number>;
  tipoRemolque: Nullable<string>;
  /** Remolques vigentes del camión (chasis, thermo, plataforma) para elegir. */
  remolques: { id: number; patente: string; tipo: string }[];
}

export interface RutaTarifaDto {
  id: number;
  codigo: string;
  clienteId: number;
  cliente: string;
  origenId: number;
  origen: string;
  destinoId: number;
  destino: string;
  unidadId: number;
  unidad: string;
  tramo: string;
  distanciaKm: Nullable<number>;
  valor: number;
  vigenciaDesde: Nullable<Fecha>;
  vigenciaHasta: Nullable<Fecha>;
  activo: boolean;
  /** Calculado contra la fecha de hoy. */
  vigente: boolean;
}

export interface RutaTarifaInput {
  /** Si se omite, el sistema propone RT-001, RT-002, ... */
  codigo?: Nullable<string>;
  clienteId: number;
  origenId: number;
  destinoId: number;
  unidadId: number;
  distanciaKm?: Nullable<number>;
  valor: number;
  vigenciaDesde?: Nullable<Fecha>;
  vigenciaHasta?: Nullable<Fecha>;
  activo?: boolean;
}

// ───────────────────────────── Documentos ─────────────────────────────

/** Filtro común de los listados de documentos (día, rango o mes se traducen a desde/hasta). */
export interface FiltroFechas {
  desde?: Fecha;
  hasta?: Fecha;
}

export interface OrdenRetiroInput {
  fecha: Fecha;
  trazabilidadId: number;
  conductorId: number;
  camionId: number;
  remolqueId?: Nullable<number>;
  empresaId: number;
  clienteId: number;
  origenId: number;
  destinoId: number;
  depositoRetiroId?: Nullable<number>;
  packingCargaId?: Nullable<number>;
  fechaCarga?: Nullable<Fecha>;
  horaCarga?: Nullable<string>;
  depositoEntregaId?: Nullable<number>;
  packingEntregaId?: Nullable<number>;
  destinoFinal?: Nullable<string>;
  nave?: Nullable<string>;
  mtb?: Nullable<string>;
  booking?: Nullable<string>;
  puertoEmbarqueId?: Nullable<number>;
  fechaEmbarque?: Nullable<Fecha>;
  horaEmbarque?: Nullable<string>;
  opNumero?: Nullable<string>;
  ordenCompra?: Nullable<string>;
  observaciones?: Nullable<string>;
}

export interface OrdenRetiroDto extends Required<OrdenRetiroInput> {
  id: number;
  numero: number;
  estado: EstadoOrdenRetiro;
  trazabilidad: string;
  conductor: string;
  conductorRut: string;
  camion: string;
  remolque: Nullable<string>;
  tipoRemolque: Nullable<string>;
  empresa: string;
  empresaRut: string;
  cliente: string;
  clienteRut: string;
  origen: string;
  destino: string;
  depositoRetiro: Nullable<string>;
  packingCarga: Nullable<string>;
  depositoEntrega: Nullable<string>;
  packingEntrega: Nullable<string>;
  puertoEmbarque: Nullable<string>;
  motivoAnulacion: Nullable<string>;
  /** Número de la orden de carga vigente, si existe. */
  ordenCargaNumero: Nullable<number>;
  ordenCargaId: Nullable<number>;
  cantidadValesDinero: number;
  cantidadValesCombustible: number;
  creadoEn: string;
}

export interface ValeDineroInput {
  ordenRetiroId: number;
  fechaEntrega: Fecha;
  concepto?: string;
  glosa?: Nullable<string>;
  sitioEntregaId: number;
  monto: number;
  formaPagoId: number;
}

export interface ValeDineroDto extends Required<ValeDineroInput> {
  id: number;
  numero: number;
  estado: EstadoDocumento;
  sitioEntrega: string;
  formaPago: string;
  motivoAnulacion: Nullable<string>;
  retiro: ResumenRetiroDto;
}

/** Datos de la orden de retiro que heredan los documentos hijos. */
export interface ResumenRetiroDto {
  id: number;
  numero: number;
  fecha: Fecha;
  estado: EstadoOrdenRetiro;
  cliente: string;
  clienteId: number;
  origen: string;
  destino: string;
  trazabilidad: string;
  conductor: string;
  conductorId: number;
  conductorRut: string;
  empresa: string;
  camion: string;
  camionId: number;
  remolque: Nullable<string>;
  remolqueId: Nullable<number>;
  tipoRemolque: Nullable<string>;
  puertoEmbarque: Nullable<string>;
  fechaEmbarque: Nullable<Fecha>;
  horaEmbarque: Nullable<string>;
  depositoRetiro: Nullable<string>;
  depositoEntrega: Nullable<string>;
  packingEntrega: Nullable<string>;
  packingCarga: Nullable<string>;
  packingCargaId: Nullable<number>;
  fechaCarga: Nullable<Fecha>;
  horaCarga: Nullable<string>;
  tieneOrdenCarga: boolean;
}

export interface GuiaFleteInput {
  numeroGuia: string;
  fechaGuia: Fecha;
  especieId?: Nullable<number>;
  umEspecieId?: Nullable<number>;
  cantidadEspecie?: Nullable<number>;
  numeroContenedor?: Nullable<string>;
  tramoId: number;
  umTarifaId?: Nullable<number>;
  cantidadTarifa: number;
  /** Opcional: si se omite se toma el valor vigente de la tarifa. */
  valorUnitario?: Nullable<number>;
}

export interface GuiaFleteDto extends Required<GuiaFleteInput> {
  id: number;
  linea: number;
  especie: Nullable<string>;
  umEspecie: Nullable<string>;
  tramoTexto: string;
  umTarifa: Nullable<string>;
  valorUnitario: number;
  total: number;
}

export interface OrdenCargaInput {
  ordenRetiroId: number;
  tramoId?: Nullable<number>;
  fechaCarga: Fecha;
  horaCarga?: Nullable<string>;
  packingCargaId?: Nullable<number>;
  observaciones?: Nullable<string>;
  guias: GuiaFleteInput[];
}

export interface OrdenCargaDto {
  id: number;
  numero: number;
  estado: EstadoOrdenCarga;
  ordenRetiroId: number;
  tramoId: Nullable<number>;
  tramo: Nullable<string>;
  fechaCarga: Fecha;
  horaCarga: Nullable<string>;
  packingCargaId: Nullable<number>;
  packingCarga: Nullable<string>;
  patenteCamion: string;
  patenteRemolque: Nullable<string>;
  hojaRuta: Nullable<number>;
  guiasConfirmadas: Nullable<string>;
  totalNeto: number;
  observaciones: Nullable<string>;
  motivoAnulacion: Nullable<string>;
  guias: GuiaFleteDto[];
  retiro: ResumenRetiroDto;
  rendicionNumero: Nullable<number>;
  rendicionId: Nullable<number>;
}

export interface ValeCombustibleInput {
  ordenRetiroId: number;
  fechaEntrega: Fecha;
  horaEntrega?: Nullable<string>;
  sitioEntregaId: number;
  formaPagoId?: Nullable<number>;
  tipoDocumentoId?: Nullable<number>;
  camionId: number;
  remolqueId?: Nullable<number>;
  numeralInicialCamion?: Nullable<number>;
  numeralFinalCamion?: Nullable<number>;
  numeralInicialRemolque?: Nullable<number>;
  numeralFinalRemolque?: Nullable<number>;
  valorLitro: number;
  observaciones?: Nullable<string>;
}

export interface ValeCombustibleDto extends Required<ValeCombustibleInput> {
  id: number;
  numero: number;
  estado: EstadoDocumento;
  sitioEntrega: string;
  formaPago: Nullable<string>;
  tipoDocumento: Nullable<string>;
  camion: string;
  remolque: Nullable<string>;
  litrosCamion: number;
  litrosRemolque: number;
  totalLitros: number;
  total: number;
  motivoAnulacion: Nullable<string>;
  retiro: ResumenRetiroDto;
}

export interface ViaticoInput {
  fecha: Fecha;
  desayuno?: Nullable<number>;
  almuerzo?: Nullable<number>;
  comida?: Nullable<number>;
}

export interface GastoInput {
  tipoDocumentoId?: Nullable<number>;
  numeroDocumento?: Nullable<string>;
  rutProveedor?: Nullable<string>;
  fecha?: Nullable<Fecha>;
  monto: number;
  itemGastoId?: Nullable<number>;
  observaciones?: Nullable<string>;
}

export interface RendicionInput {
  ordenCargaId: number;
  fecha: Fecha;
  fechaSalida?: Nullable<Fecha>;
  horaSalida?: Nullable<string>;
  fechaLlegada?: Nullable<Fecha>;
  horaLlegada?: Nullable<string>;
  odometroInicial?: Nullable<number>;
  odometroFinal?: Nullable<number>;
  horometroInicial?: Nullable<number>;
  horometroFinal?: Nullable<number>;
  /** Lo indica el conductor: si el motor del remolque funcionó durante el flete. */
  remolqueConMotor?: Nullable<boolean>;
  observaciones?: Nullable<string>;
  fechaEntrega?: Nullable<Fecha>;
  sitioEntregaId?: Nullable<number>;
  peajes?: Nullable<number>;
  carga?: Nullable<number>;
  descarga?: Nullable<number>;
  petroleo?: Nullable<number>;
  viaticos: ViaticoInput[];
  gastos: GastoInput[];
}

export interface RendicionDto {
  id: number;
  numero: number;
  estado: EstadoDocumento;
  ordenCargaId: number;
  ordenCargaNumero: number;
  tramo: Nullable<string>;
  fechaCarga: Fecha;
  horaCarga: Nullable<string>;
  packingCarga: Nullable<string>;
  patenteCamion: string;
  patenteRemolque: Nullable<string>;
  fecha: Fecha;
  fechaSalida: Nullable<Fecha>;
  horaSalida: Nullable<string>;
  fechaLlegada: Nullable<Fecha>;
  horaLlegada: Nullable<string>;
  odometroInicial: Nullable<number>;
  odometroFinal: Nullable<number>;
  kmRecorridos: Nullable<number>;
  horometroInicial: Nullable<number>;
  horometroFinal: Nullable<number>;
  horasMotor: Nullable<number>;
  remolqueConMotor: Nullable<boolean>;
  observaciones: Nullable<string>;
  fechaEntrega: Nullable<Fecha>;
  sitioEntregaId: Nullable<number>;
  sitioEntrega: Nullable<string>;
  peajes: number;
  carga: number;
  descarga: number;
  petroleo: number;
  totalViaticos: number;
  totalOtrosGastos: number;
  totalGeneral: number;
  motivoAnulacion: Nullable<string>;
  viaticos: (Required<ViaticoInput> & { id: number; total: number })[];
  gastos: (Required<GastoInput> & {
    id: number;
    tipoDocumento: Nullable<string>;
    itemGasto: Nullable<string>;
  })[];
  retiro: ResumenRetiroDto;
}

// ───────────────────────────── Inicio y exportación ─────────────────────────────

export interface VencimientoDto {
  tipo: 'Revisión técnica' | 'Permiso de circulación' | 'Seguro' | 'Licencia';
  referencia: string;
  detalle: string;
  fecha: Fecha;
  /** Días restantes (negativo si ya venció). */
  dias: number;
  ruta: string;
}

export interface InicioDto {
  hoy: Fecha;
  contadores: {
    retirosAbiertos: number;
    retirosSinCarga: number;
    cargasPorRendir: number;
    cargasSinConfirmar: number;
    valesDineroMes: number;
    montoValesDineroMes: number;
    combustibleMesLitros: number;
    tarifasVencidas: number;
  };
  retirosSinCarga: ResumenRetiroDto[];
  cargasPorRendir: {
    id: number;
    numero: number;
    fechaCarga: Fecha;
    cliente: string;
    conductor: string;
    patenteCamion: string;
    totalNeto: number;
    hojaRuta: Nullable<number>;
  }[];
  vencimientos: VencimientoDto[];
}

export type FormatoExportacion = 'pdf' | 'xlsx';
export type TipoColumna = 'texto' | 'fecha' | 'pesos' | 'numero' | 'decimal' | 'porcentaje' | 'booleano';

export interface ColumnaExportacion {
  campo: string;
  titulo: string;
  tipo?: TipoColumna;
}

export interface ExportarTablaInput {
  titulo: string;
  subtitulo?: string;
  formato: FormatoExportacion;
  columnas: ColumnaExportacion[];
  filas: Record<string, unknown>[];
}
