import { aEntrada, construirFormulario, mensajeError, type CampoFormulario } from './formulario';

const CAMPOS: CampoFormulario[] = [
  { campo: 'rut', etiqueta: 'RUT', tipo: 'rut', requerido: true },
  { campo: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, max: 10 },
  { campo: 'comision', etiqueta: '% Comisión', tipo: 'porcentaje' },
  { campo: 'vence', etiqueta: 'Vencimiento', tipo: 'fecha' },
  { campo: 'activo', etiqueta: 'Activo', tipo: 'booleano' },
  { campo: 'resumen', etiqueta: 'Resumen', tipo: 'calculado', calcular: () => 'x' },
];

describe('formularios dinámicos', () => {
  it('convierte los valores de la API al formulario y de vuelta', () => {
    const form = construirFormulario(
      CAMPOS,
      { rut: '9.809.727-9', nombre: 'LUIS', comision: 0.08, vence: '2026-12-31' },
      true,
    );
    expect(form.get('comision')!.value).toBe(8);
    expect(form.get('vence')!.value).toBeInstanceOf(Date);
    expect(form.get('activo')!.value).toBe(true);
    expect(form.get('resumen')).toBeNull();

    form.patchValue({ nombre: '  LUIS  ', comision: 12.5 });
    expect(aEntrada(CAMPOS, form)).toEqual({
      rut: '9.809.727-9',
      nombre: 'LUIS',
      comision: 0.125,
      vence: '2026-12-31',
      activo: true,
    });
  });

  it('valida obligatorios, largo máximo y RUT', () => {
    const form = construirFormulario(CAMPOS, {}, false);
    expect(form.valid).toBe(false);
    form.patchValue({ rut: '77.862.070-8', nombre: 'NOMBRE DEMASIADO LARGO' });
    form.markAllAsTouched();
    expect(mensajeError(form.get('rut'))).toMatch(/RUT no válido/);
    expect(mensajeError(form.get('nombre'))).toBe('Máximo 10 caracteres.');
    form.patchValue({ rut: '778620707', nombre: 'OK' });
    expect(form.valid).toBe(true);
    expect(aEntrada(CAMPOS, form)['rut']).toBe('77.862.070-7');
  });

  it('permite editar un registro importado con RUT erróneo sin obligar a corregirlo', () => {
    const form = construirFormulario(CAMPOS, { rut: '88.870.010-7', nombre: 'B&B' }, true);
    expect(form.get('rut')!.valid).toBe(true);
    form.patchValue({ rut: '88.870.010-8' });
    expect(form.get('rut')!.valid).toBe(false);
  });
});
