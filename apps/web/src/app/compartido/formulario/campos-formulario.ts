import { Component, input } from '@angular/core';
import { ReactiveFormsModule, type FormGroup } from '@angular/forms';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { CampoFecha } from './campo-fecha';
import { mensajeError, type CampoFormulario } from './formulario';
import { RutInput } from './rut';

/** Dibuja los campos de un formulario en una grilla de 4 columnas según su configuración. */
@Component({
  selector: 'nt-campos',
  imports: [
    ReactiveFormsModule,
    InputText,
    InputNumber,
    CampoFecha,
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

  error(campo: string): string | null {
    return mensajeError(this.form().get(campo));
  }

  valores(): Record<string, any> {
    return this.form().getRawValue();
  }

  /** Al salir del campo: mayúsculas. */
  normalizar(c: CampoFormulario): void {
    const control = this.form().get(c.campo);
    const v = control?.value;
    if (!c.mayusculas || typeof v !== 'string' || !v) return;
    if (v.toUpperCase() !== v) control!.setValue(v.toUpperCase());
  }
}
