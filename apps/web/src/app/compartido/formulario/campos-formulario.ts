import { Component, input } from '@angular/core';
import { ReactiveFormsModule, type FormGroup } from '@angular/forms';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { CampoFecha } from './campo-fecha';
import { CampoHora } from './campo-hora';
import { mensajeError, type CampoFormulario } from './formulario';
import { RutInput } from './rut';

/** Dibuja los campos de un formulario en una grilla de 4 (o 5) columnas según su configuración. */
@Component({
  selector: 'nt-campos',
  imports: [
    ReactiveFormsModule,
    InputText,
    InputNumber,
    CampoFecha,
    CampoHora,
    RutInput,
    Select,
    ToggleSwitch,
    Textarea,
    Password,
  ],
  templateUrl: './campos-formulario.html',
})
export class CamposFormulario {
  readonly form = input.required<FormGroup>();
  readonly campos = input.required<CampoFormulario[]>();
  readonly soloLectura = input(false);
  readonly columnas = input<4 | 5>(4);

  error(campo: string): string | null {
    return mensajeError(this.form().get(campo));
  }

  valores(): Record<string, any> {
    return this.form().getRawValue();
  }

  /** Al salir del campo: mayúsculas y el formato propio del campo. */
  normalizar(c: CampoFormulario): void {
    const control = this.form().get(c.campo);
    const v = control?.value;
    if (typeof v !== 'string' || !v) return;
    let nuevo = c.mayusculas ? v.toUpperCase() : v;
    if (c.formatear) nuevo = c.formatear(nuevo);
    if (nuevo !== v) control!.setValue(nuevo);
  }
}
