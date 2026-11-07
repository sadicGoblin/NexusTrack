import {
  FormControl,
  FormGroup,
  Validators,
  type AbstractControl,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';
import { esRutValido, formatearRut } from '@nexustrack/shared';
import type { Opcion } from '../../nucleo/datos-maestros.service';
import { dateAIso, isoADate } from '../../nucleo/fechas';

export type TipoCampo =
  | 'texto'
  | 'rut'
  | 'email'
  | 'telefono'
  | 'password'
  | 'textarea'
  | 'entero'
  | 'decimal'
  | 'pesos'
  | 'porcentaje'
  | 'fecha'
  | 'hora'
  | 'booleano'
  | 'select'
  | 'calculado';

export interface CampoFormulario {
  campo: string;
  etiqueta: string;
  tipo: TipoCampo;
  requerido?: boolean;
  /** Requerido solo al crear (por ejemplo, la contraseña de un usuario nuevo). */
  requeridoAlCrear?: boolean;
  ancho?: 1 | 2 | 3 | 4;
  /** Opciones para listas; se evalúa en cada render, por lo que puede leer señales. */
  opciones?: (valores: Record<string, any>) => Opcion<unknown>[];
  ayuda?: string;
  placeholder?: string;
  max?: number;
  min?: number;
  decimales?: number;
  /** Separador de miles en números (por defecto sí, salvo en 'entero' marcado como año). */
  agrupar?: boolean;
  mayusculas?: boolean;
  /** Formato del texto al salir del campo y al guardar (por ejemplo, COX005 → COX-005). */
  formatear?: (valor: string) => string;
  /** Valor mostrado en campos calculados (solo lectura). */
  calcular?: (valores: Record<string, any>) => string;
  /** No editable una vez creado el registro. */
  soloCreacion?: boolean;
  /** Lo asigna el sistema (por ejemplo, el código PK-001): no se muestra al crear ni se envía. */
  automatico?: boolean;
}

const MENSAJES: Record<string, (e: any) => string> = {
  required: () => 'Campo obligatorio.',
  email: () => 'Correo no válido.',
  rut: () => 'RUT no válido (revise el dígito verificador).',
  maxlength: (e) => `Máximo ${e.requiredLength} caracteres.`,
  min: (e) => `Debe ser mayor o igual a ${e.min}.`,
  max: (e) => `Debe ser menor o igual a ${e.max}.`,
};

export function mensajeError(control: AbstractControl | null): string | null {
  if (!control || !control.errors || !(control.touched || control.dirty)) return null;
  const [clave, detalle] = Object.entries(control.errors)[0];
  return MENSAJES[clave]?.(detalle) ?? 'Valor no válido.';
}

/** Valida módulo 11 solo si el RUT cambió respecto del valor inicial (registros importados con errores). */
export function validadorRut(inicial?: string | null): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const v = c.value as string | null;
    if (!v || v === inicial || formatearRut(v) === inicial) return null;
    return esRutValido(v) ? null : { rut: true };
  };
}

/** Construye el FormGroup de un formulario a partir de su configuración y valores iniciales. */
export function construirFormulario(
  campos: CampoFormulario[],
  dto: Record<string, any>,
  editando: boolean,
): FormGroup {
  const controles: Record<string, FormControl> = {};
  for (const c of campos) {
    if (c.tipo === 'calculado') continue;
    const validadores: ValidatorFn[] = [];
    if (c.requerido || (c.requeridoAlCrear && !editando)) validadores.push(Validators.required);
    if (c.tipo === 'email') validadores.push(Validators.email);
    if (c.tipo === 'rut') validadores.push(validadorRut(editando ? dto[c.campo] : null));
    if (['texto', 'email', 'telefono', 'textarea', 'password'].includes(c.tipo))
      validadores.push(Validators.maxLength(c.max ?? 200));
    if (c.min !== undefined && c.tipo !== 'texto') validadores.push(Validators.min(c.min));
    if (
      c.max !== undefined &&
      !['texto', 'email', 'telefono', 'textarea', 'password'].includes(c.tipo)
    )
      validadores.push(Validators.max(c.max));
    controles[c.campo] = new FormControl(
      {
        value: aControl(c, dto[c.campo]),
        disabled: c.automatico || (!!c.soloCreacion && editando),
      },
      validadores,
    );
  }
  return new FormGroup(controles);
}

function aControl(c: CampoFormulario, valor: unknown): unknown {
  if (valor === undefined) return c.tipo === 'booleano' ? true : null;
  if (c.tipo === 'fecha') return isoADate(valor as string);
  if (c.tipo === 'porcentaje')
    return valor === null ? null : Math.round((valor as number) * 10000) / 100;
  return valor;
}

/** Convierte los valores del formulario al formato de la API (fechas ISO, fracciones, nulos). */
export function aEntrada(campos: CampoFormulario[], form: FormGroup): Record<string, unknown> {
  const valores = form.getRawValue() as Record<string, unknown>;
  const salida: Record<string, unknown> = {};
  for (const c of campos) {
    if (c.tipo === 'calculado' || c.automatico) continue;
    let v = valores[c.campo];
    if (typeof v === 'string') {
      v = v.trim();
      if (v === '') v = null;
    }
    if (c.tipo === 'fecha') v = dateAIso(v as Date | null);
    if (c.tipo === 'porcentaje' && v !== null && v !== undefined)
      v = Math.round((v as number) * 100) / 10000;
    if (c.tipo === 'rut' && v) v = formatearRut(v as string);
    if (c.formatear && typeof v === 'string') v = c.formatear(v);
    salida[c.campo] = v ?? null;
  }
  return salida;
}
