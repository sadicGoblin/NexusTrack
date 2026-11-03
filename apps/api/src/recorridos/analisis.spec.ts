import { analizarRecorrido, distanciaKm, type Punto } from './analisis.js';
import { aPuntos, coincidePatente } from './fm-track.js';
import { chileAUtc } from '../comun/fechas.js';
import { inicioVentana } from './historial-gps.js';

const INICIO = Date.parse('2026-10-28T12:00:00Z');

/** Posiciones cada 30 s: quieto, quieto con motor apagado o avanzando hacia el norte. */
function tramo(
  desdeMin: number,
  minutos: number,
  lat0: number,
  kmh: number,
  encendido: 0 | 1 = 1,
): Punto[] {
  const puntos: Punto[] = [];
  for (let s = 0; s < minutos * 60; s += 30) {
    // 1° de latitud ≈ 111,2 km
    const lat = lat0 + (kmh * (s / 3600)) / 111.2;
    puntos.push({
      t: INICIO + (desdeMin * 60 + s) * 1000,
      lat,
      lng: -71.6,
      velocidad: kmh,
      encendido,
      odometro: null,
    });
  }
  return puntos;
}

describe('análisis del recorrido', () => {
  // Quieto 10 min, 30 min a 80 km/h, parada de 20 min con motor apagado, 15 min a 60 km/h.
  const lat1 = -35.4 + 40 / 111.2;
  const puntos = [
    ...tramo(0, 10, -35.4, 0),
    ...tramo(10, 30, -35.4, 80),
    ...tramo(40, 20, lat1, 0, 0),
    ...tramo(60, 15, lat1, 60),
  ];
  const r = analizarRecorrido(puntos);

  it('separa viajes y paradas', () => {
    expect(r.viajes).toHaveLength(2);
    expect(r.paradas).toHaveLength(2);
    expect(r.paradas[1]).toMatchObject({ motorApagado: true });
    expect(r.paradas[0]).toMatchObject({ motorApagado: false });
  });

  it('mide distancia, tiempos y velocidades', () => {
    expect(r.viajes[0]!.distanciaKm).toBeCloseTo(40, 0);
    expect(r.resumen.distanciaKm).toBeCloseTo(54.5, 0);
    expect(r.resumen.velocidadMax).toBe(80);
    expect(r.resumen.movimientoSeg).toBeGreaterThan(44 * 60);
    expect(r.resumen.detenidoSeg).toBeGreaterThan(28 * 60);
    expect(r.ruta.length).toBeLessThan(puntos.length);
  });

  it('descarta saltos imposibles del GPS', () => {
    const conSalto = [...tramo(0, 5, -35.4, 0)];
    conSalto.splice(4, 0, { ...conSalto[4]!, t: conSalto[4]!.t - 1, lat: -33 });
    const a = analizarRecorrido(conSalto);
    expect(a.resumen.distanciaKm).toBe(0);
    expect(a.resumen.puntos).toBe(conSalto.length - 1);
  });

  it('responde vacío sin posiciones', () => {
    expect(analizarRecorrido([])).toMatchObject({
      viajes: [],
      paradas: [],
      ruta: [],
    });
  });

  it('calcula distancias reales', () => {
    // Santiago - Valparaíso en línea recta: ~98 km
    expect(
      distanciaKm(
        { lat: -33.4489, lng: -70.6693 },
        { lat: -33.0472, lng: -71.6127 },
      ),
    ).toBeCloseTo(98, -1);
  });
});

describe('fm-track', () => {
  it('reconoce la patente en el nombre del vehículo', () => {
    const v = { id: '1', nombre: 'CDSP97. Luis Gaete', patente: null };
    expect(coincidePatente(v, 'CDSP97')).toBe(true);
    expect(coincidePatente(v, 'cd-sp97')).toBe(true);
    expect(coincidePatente(v, 'CDSP98')).toBe(false);
    // Nombres reales del grupo: camión y remolque juntos, o sin espacio tras el punto.
    const conRemolque = {
      id: '2',
      nombre: 'CFGG63-JJ9104. Axel Rey',
      patente: null,
    };
    expect(coincidePatente(conRemolque, 'CFGG63')).toBe(true);
    expect(coincidePatente(conRemolque, 'JJ9104')).toBe(true);
    expect(
      coincidePatente(
        { id: '3', nombre: 'FXRW41.Sergio Allende', patente: null },
        'FXRW41',
      ),
    ).toBe(true);
    expect(
      coincidePatente(
        { id: '4', nombre: 'YY3752-JJ8766, Ariel Hernández', patente: null },
        'YY3752',
      ),
    ).toBe(true);
    expect(
      coincidePatente({ id: '5', nombre: 'WT9877', patente: null }, 'WT9878'),
    ).toBe(false);
    expect(
      coincidePatente(
        { id: '2', nombre: 'Camión 3', patente: 'JH-7077' },
        'JH7077',
      ),
    ).toBe(true);
  });

  it('normaliza las posiciones y descarta las inválidas', () => {
    const p = aPuntos([
      {
        datetime: '2026-10-28T12:01:00Z',
        ignition_status: 'OFF',
        position: { latitude: -35.4, longitude: -71.6, speed: 0 },
        calculated_inputs: { mileage: 1000.5 },
      },
      {
        datetime: '2026-10-28T12:00:00Z',
        ignition_status: 'ON',
        position: { latitude: -35.41, longitude: -71.6, speed: 54 },
      },
      {
        datetime: '2026-10-28T12:02:00Z',
        position: { latitude: 0, longitude: 0 },
      },
      { datetime: 'no es fecha', position: { latitude: -35, longitude: -71 } },
    ]);
    expect(p.map((x) => [x.velocidad, x.encendido, x.odometro])).toEqual([
      [54, 1, null],
      [0, 0, 1000.5],
    ]);
  });
});

describe('captura de posiciones', () => {
  const ahora = Date.parse('2026-11-03T15:00:00Z');
  const min = 60_000;

  it('relee unos minutos ya consultados y parte con la última hora', () => {
    expect(inicioVentana(ahora - min, ahora, false)).toBe(ahora - 11 * min);
    expect(inicioVentana(undefined, ahora, false)).toBe(ahora - 60 * min);
  });

  it('revisa 6 horas una vez por hora y recupera hasta 7 días tras una caída', () => {
    expect(inicioVentana(ahora - min, ahora, true)).toBe(ahora - 6 * 60 * min);
    expect(inicioVentana(ahora - 30 * 24 * 60 * min, ahora, false)).toBe(
      ahora - 7 * 24 * 60 * min,
    );
  });
});

describe('hora de Chile', () => {
  it('convierte a UTC con horario de verano e invierno', () => {
    expect(chileAUtc('2026-11-02T09:00').toISOString()).toBe(
      '2026-11-02T12:00:00.000Z',
    );
    expect(chileAUtc('2026-07-15T09:00').toISOString()).toBe(
      '2026-07-15T13:00:00.000Z',
    );
  });
});
