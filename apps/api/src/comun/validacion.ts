/**
 * Decoradores de validación con mensajes en español y documentación OpenAPI incluida.
 * Cada uno recibe la etiqueta legible del campo como primer argumento.
 */
import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateBy,
  ValidateNested,
} from 'class-validator';
import {
  esFechaIso,
  esHora,
  formatearRut,
  limpiarRut,
} from '@nexustrack/shared';

interface Opciones {
  opcional?: boolean;
  descripcion?: string;
}

function documentar(o: Opciones, extra: Record<string, unknown>) {
  return o.opcional
    ? ApiPropertyOptional({
        nullable: true,
        description: o.descripcion,
        ...extra,
      })
    : ApiProperty({ description: o.descripcion, ...extra });
}

const siOpcional = (o: Opciones) => (o.opcional ? [IsOptional()] : []);
const vacioANulo = (v: unknown) => (v === '' || v === undefined ? null : v);

export function Texto(
  etiqueta: string,
  o: Opciones & { max?: number; mayusculas?: boolean } = {},
) {
  const max = o.max ?? 200;
  return applyDecorators(
    documentar(o, { type: String, maxLength: max }),
    Transform(({ value }) => {
      if (typeof value !== 'string') return value;
      const t = value.replace(/\s+/g, ' ').trim();
      if (t === '') return o.opcional ? null : '';
      return o.mayusculas ? t.toUpperCase() : t;
    }),
    ...siOpcional(o),
    IsString({ message: `${etiqueta} debe ser texto.` }),
    ...(o.opcional
      ? []
      : [IsNotEmpty({ message: `${etiqueta} es obligatorio.` })]),
    MaxLength(max, {
      message: `${etiqueta} admite como máximo ${max} caracteres.`,
    }),
  );
}

/** RUT: se normaliza a 12.345.678-9. El dígito verificador se valida en el servicio (ver validarRut). */
export function Rut(etiqueta: string, o: Opciones = {}) {
  return applyDecorators(
    documentar(o, { type: String, example: '76.123.456-0' }),
    Transform(({ value }) =>
      typeof value === 'string' && value.trim()
        ? formatearRut(value)
        : vacioANulo(value),
    ),
    ...siOpcional(o),
    IsString({ message: `${etiqueta} debe ser texto.` }),
    ValidateBy(
      {
        name: 'rutFormato',
        validator: {
          validate: (v) =>
            typeof v === 'string' && /^\d{1,8}[0-9K]$/.test(limpiarRut(v)),
        },
      },
      { message: `${etiqueta} no tiene formato de RUT (ej. 12.345.678-9).` },
    ),
  );
}

export function Correo(etiqueta: string, o: Opciones = {}) {
  return applyDecorators(
    documentar(o, { type: String, format: 'email' }),
    Transform(({ value }) =>
      typeof value === 'string'
        ? value.trim().toLowerCase() || null
        : vacioANulo(value),
    ),
    ...siOpcional(o),
    IsEmail({}, { message: `${etiqueta} no es un correo válido.` }),
    MaxLength(150, {
      message: `${etiqueta} admite como máximo 150 caracteres.`,
    }),
  );
}

export function Entero(
  etiqueta: string,
  o: Opciones & { min?: number; max?: number } = {},
) {
  return applyDecorators(
    documentar(o, { type: Number, minimum: o.min, maximum: o.max }),
    Transform(({ value }) =>
      value === '' ? null : typeof value === 'string' ? Number(value) : value,
    ),
    ...siOpcional(o),
    IsInt({ message: `${etiqueta} debe ser un número entero.` }),
    ...(o.min !== undefined
      ? [
          Min(o.min, {
            message: `${etiqueta} debe ser mayor o igual a ${o.min}.`,
          }),
        ]
      : []),
    ...(o.max !== undefined
      ? [
          Max(o.max, {
            message: `${etiqueta} debe ser menor o igual a ${o.max}.`,
          }),
        ]
      : []),
  );
}

/** Monto en pesos: entero mayor o igual a cero. */
export function Monto(
  etiqueta: string,
  o: Opciones & { positivo?: boolean } = {},
) {
  return Entero(etiqueta, {
    ...o,
    min: o.positivo ? 1 : 0,
    max: 999_999_999_999,
  });
}

export function Decimal(
  etiqueta: string,
  o: Opciones & { min?: number; max?: number; decimales?: number } = {},
) {
  return applyDecorators(
    documentar(o, { type: Number, minimum: o.min, maximum: o.max }),
    Transform(({ value }) =>
      value === '' ? null : typeof value === 'string' ? Number(value) : value,
    ),
    ...siOpcional(o),
    IsNumber(
      {
        maxDecimalPlaces: o.decimales ?? 2,
        allowNaN: false,
        allowInfinity: false,
      },
      {
        message: `${etiqueta} debe ser un número con hasta ${o.decimales ?? 2} decimales.`,
      },
    ),
    ...(o.min !== undefined
      ? [
          Min(o.min, {
            message: `${etiqueta} debe ser mayor o igual a ${o.min}.`,
          }),
        ]
      : []),
    ...(o.max !== undefined
      ? [
          Max(o.max, {
            message: `${etiqueta} debe ser menor o igual a ${o.max}.`,
          }),
        ]
      : []),
  );
}

/** Identificador de otro registro (llave foránea). */
export function Id(etiqueta: string, o: Opciones = {}) {
  return applyDecorators(
    documentar(o, { type: Number, minimum: 1 }),
    Transform(({ value }) =>
      value === '' ? null : typeof value === 'string' ? Number(value) : value,
    ),
    ...siOpcional(o),
    IsInt({ message: `Seleccione ${etiqueta.toLowerCase()}.` }),
    Min(1, { message: `Seleccione ${etiqueta.toLowerCase()}.` }),
  );
}

export function Fecha(etiqueta: string, o: Opciones = {}) {
  return applyDecorators(
    documentar(o, { type: String, format: 'date', example: '2026-10-20' }),
    Transform(({ value }) => vacioANulo(value)),
    ...siOpcional(o),
    ValidateBy(
      { name: 'fechaIso', validator: { validate: (v) => esFechaIso(v) } },
      {
        message: `${etiqueta} debe ser una fecha válida (AAAA-MM-DD).`,
      },
    ),
  );
}

export function Hora(etiqueta: string, o: Opciones = {}) {
  return applyDecorators(
    documentar(o, { type: String, example: '08:30' }),
    Transform(({ value }) => vacioANulo(value)),
    ...siOpcional(o),
    ValidateBy(
      { name: 'hora', validator: { validate: (v) => esHora(v) } },
      {
        message: `${etiqueta} debe ser una hora válida (HH:mm).`,
      },
    ),
  );
}

export function Booleano(etiqueta: string, o: Opciones = {}) {
  return applyDecorators(
    documentar(o, { type: Boolean }),
    Transform(({ value }) =>
      value === 'true' ? true : value === 'false' ? false : value,
    ),
    ...siOpcional(o),
    IsBoolean({ message: `${etiqueta} debe ser verdadero o falso.` }),
  );
}

export function Opcion(
  etiqueta: string,
  valores: readonly string[],
  o: Opciones = {},
) {
  return applyDecorators(
    documentar(o, { enum: valores }),
    ...siOpcional(o),
    IsIn(valores as string[], {
      message: `${etiqueta} debe ser uno de: ${valores.join(', ')}.`,
    }),
  );
}

export function Lista<T>(
  etiqueta: string,
  tipo: () => new () => T,
  o: { max?: number } = {},
) {
  return applyDecorators(
    ApiProperty({ type: () => [tipo()] }),
    IsArray({ message: `${etiqueta} debe ser una lista.` }),
    ArrayMaxSize(o.max ?? 200, {
      message: `${etiqueta} admite como máximo ${o.max ?? 200} elementos.`,
    }),
    ValidateNested({ each: true }),
    Type(tipo),
  );
}
