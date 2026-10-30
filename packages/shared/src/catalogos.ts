/**
 * Metadatos de las 14 listas maestras (hoja BaseDatos de la planilla original).
 */

export const TipoCatalogo = {
  CIUDAD: 'CIUDAD',
  PUERTO_EMBARQUE: 'PUERTO_EMBARQUE',
  DEPOSITO: 'DEPOSITO',
  TRAZABILIDAD: 'TRAZABILIDAD',
  TIPO_MOVIL: 'TIPO_MOVIL',
  CATEGORIA_EMPRESA: 'CATEGORIA_EMPRESA',
  UNIDAD_RUTA: 'UNIDAD_RUTA',
  ESPECIE: 'ESPECIE',
  UM_ESPECIE: 'UM_ESPECIE',
  UM_TARIFA: 'UM_TARIFA',
  SITIO_ENTREGA: 'SITIO_ENTREGA',
  FORMA_PAGO: 'FORMA_PAGO',
  TIPO_DOCUMENTO: 'TIPO_DOCUMENTO',
  ITEM_GASTO: 'ITEM_GASTO',
} as const;
export type TipoCatalogo = (typeof TipoCatalogo)[keyof typeof TipoCatalogo];

export interface CatalogoMeta {
  tipo: TipoCatalogo;
  titulo: string;
  /** Título de la columna en la hoja BaseDatos del Excel original. */
  tituloExcel: string;
  /** Si es true, los valores tienen un código fijo que usa la lógica y no se pueden crear nuevos. */
  sistema: boolean;
}

export const CATALOGOS: readonly CatalogoMeta[] = [
  { tipo: 'CIUDAD', titulo: 'Ciudades', tituloExcel: 'CIUDADES', sistema: false },
  {
    tipo: 'PUERTO_EMBARQUE',
    titulo: 'Puertos de embarque',
    tituloExcel: 'PUERTOS DE EMBARQUE',
    sistema: false,
  },
  { tipo: 'DEPOSITO', titulo: 'Depósitos de retiro', tituloExcel: 'DEPOSITOS DE RETIRO', sistema: false },
  { tipo: 'TRAZABILIDAD', titulo: 'Trazabilidades', tituloExcel: 'TRAZABILIDADES', sistema: false },
  { tipo: 'TIPO_MOVIL', titulo: 'Tipos de móviles', tituloExcel: 'TIPOS DE MOVILES', sistema: true },
  {
    tipo: 'CATEGORIA_EMPRESA',
    titulo: 'Categorías de empresa',
    tituloExcel: 'CATEGORIAS DE EMPRESA',
    sistema: true,
  },
  { tipo: 'UNIDAD_RUTA', titulo: 'Unidades de rutas', tituloExcel: 'UNIDADES DE RUTAS', sistema: false },
  { tipo: 'ESPECIE', titulo: 'Especies', tituloExcel: 'ESPECIES', sistema: false },
  {
    tipo: 'UM_ESPECIE',
    titulo: 'Unidad de medida especie',
    tituloExcel: 'UNIDAD DE MEDIDA ESPECIE',
    sistema: false,
  },
  {
    tipo: 'UM_TARIFA',
    titulo: 'Unidad de medida tarifa',
    tituloExcel: 'UNIDAD DE MEDIDA TARIFA',
    sistema: false,
  },
  { tipo: 'SITIO_ENTREGA', titulo: 'Sitios de entrega', tituloExcel: 'SITIOS DE ENTREGA', sistema: false },
  { tipo: 'FORMA_PAGO', titulo: 'Formas de pago', tituloExcel: 'FORMAS PAGO', sistema: false },
  { tipo: 'TIPO_DOCUMENTO', titulo: 'Tipos de documento', tituloExcel: 'TIPOS DE DOCUMENTO', sistema: false },
  { tipo: 'ITEM_GASTO', titulo: 'Ítems de gasto', tituloExcel: 'ITEMS GASTO', sistema: false },
];

export function catalogoMeta(tipo: TipoCatalogo): CatalogoMeta {
  const meta = CATALOGOS.find((c) => c.tipo === tipo);
  if (!meta) throw new Error(`Catálogo desconocido: ${tipo}`);
  return meta;
}

/** Códigos fijos de los tipos de móvil. */
export const CodigoTipoMovil = {
  CAMION: 'CAMION',
  TRACTOCAMION: 'TRACTOCAMION',
  CHASIS_CON_MOTOR: 'CHASIS_CON_MOTOR',
  CHASIS_SIN_MOTOR: 'CHASIS_SIN_MOTOR',
  PLATAFORMA: 'PLATAFORMA',
  THERMO: 'THERMO',
} as const;
export type CodigoTipoMovil = (typeof CodigoTipoMovil)[keyof typeof CodigoTipoMovil];

/** Agrupación de tipos de móvil según su rol en una asignación. */
export const GRUPOS_MOVIL = {
  camion: ['CAMION', 'TRACTOCAMION'],
  chasis: ['CHASIS_CON_MOTOR', 'CHASIS_SIN_MOTOR'],
  thermo: ['THERMO'],
  plataforma: ['PLATAFORMA'],
} as const satisfies Record<string, readonly CodigoTipoMovil[]>;
export type GrupoMovil = keyof typeof GRUPOS_MOVIL;

export const TIPOS_REMOLQUE: readonly CodigoTipoMovil[] = [
  ...GRUPOS_MOVIL.chasis,
  ...GRUPOS_MOVIL.thermo,
  ...GRUPOS_MOVIL.plataforma,
];

/** Códigos fijos de las categorías de empresa. */
export const CodigoCategoriaEmpresa = {
  SOCIO: 'SOCIO',
  FLETERO: 'FLETERO',
  EXTERNO: 'EXTERNO',
} as const;
export type CodigoCategoriaEmpresa = (typeof CodigoCategoriaEmpresa)[keyof typeof CodigoCategoriaEmpresa];
