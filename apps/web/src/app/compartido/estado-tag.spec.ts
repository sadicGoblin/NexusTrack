import { TestBed } from '@angular/core/testing';
import { EstadoTag } from './estado-tag';

describe('EstadoTag', () => {
  it('muestra la etiqueta en español del estado', async () => {
    const fixture = TestBed.createComponent(EstadoTag);
    fixture.componentRef.setInput('estado', 'CON_CARGA');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Con carga');
  });

  it('no muestra nada sin estado', async () => {
    const fixture = TestBed.createComponent(EstadoTag);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('');
  });
});
