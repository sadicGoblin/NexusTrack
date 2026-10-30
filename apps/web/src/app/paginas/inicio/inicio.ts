import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import type { InicioDto } from '@nexustrack/shared';
import { ApiService } from '../../nucleo/api.service';
import { CorrelativoPipe, FechaPipe, NumeroPipe, PesosPipe } from '../../nucleo/pipes';
import { SesionService } from '../../nucleo/sesion.service';

@Component({
  selector: 'nt-inicio',
  imports: [RouterLink, Button, Skeleton, Tag, CorrelativoPipe, FechaPipe, PesosPipe, NumeroPipe],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
})
export class Inicio implements OnInit {
  private readonly api = inject(ApiService);
  private readonly sesion = inject(SesionService);

  readonly datos = signal<InicioDto | null>(null);
  readonly nombre = computed(() => this.sesion.usuario()?.nombre.split(' ')[0] ?? '');
  readonly puedeOperacion = computed(() => this.sesion.puede('editarOperacion'));
  readonly puedeFinanzas = computed(() => this.sesion.puede('editarFinanzas'));
  readonly saludo = computed(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  });
  readonly fechaLarga = ((t: string) => t.charAt(0).toUpperCase() + t.slice(1))(
    new Intl.DateTimeFormat('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date()),
  );

  async ngOnInit(): Promise<void> {
    this.datos.set(await this.api.get<InicioDto>('inicio'));
  }

  severidad(dias: number): 'danger' | 'warn' | 'info' {
    return dias < 0 ? 'danger' : dias <= 7 ? 'warn' : 'info';
  }

  textoDias(dias: number): string {
    if (dias < 0) return `Vencido hace ${-dias} día${dias === -1 ? '' : 's'}`;
    if (dias === 0) return 'Vence hoy';
    return `Vence en ${dias} día${dias === 1 ? '' : 's'}`;
  }
}
