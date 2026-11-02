/**
 * Análisis de un recorrido GPS (puro, sin I/O). Mismo método que el historial del mapa de la
 * plataforma de integraciones GPS:
 *   - Un tramo entre dos posiciones seguidas es «en movimiento» si se desplazó al menos
 *     `radioQuietoKm`, o si en menos de 5 min informó velocidad y se movió más de 20 m (evita el
 *     ruido del GPS de un camión estacionado).
 *   - Los saltos imposibles (más de `velocidadErrorKmh` y más de 1 km) son errores del GPS.
 *   - Parada: quieto al menos `paradaMinSeg`. Las más cortas (semáforos, peajes) son parte del viaje.
 *   - Un desplazamiento menor a `viajeMinKm` entre dos paradas (acomodar el camión en un patio)
 *     no es un viaje: se funde con las paradas vecinas.
 *   - Si el equipo deja de informar estando quieto (motor apagado), el hueco cuenta como parada.
 */
import type {
  ParadaRecorridoDto,
  ResumenRecorridoDto,
  ViajeRecorridoDto,
} from '@nexustrack/shared';

export interface Punto {
  /** Milisegundos desde 1970. */
  t: number;
  lat: number;
  lng: number;
  velocidad: number;
  /** 1 encendido, 0 apagado, null sin dato. */
  encendido: 0 | 1 | null;
  /** Odómetro del equipo en km, si lo informa. */
  odometro: number | null;
}

export const PARAMETROS = {
  paradaMinSeg: 300,
  viajeMinKm: 0.5,
  velocidadQuietoKmh: 3,
  radioQuietoKm: 0.15,
  velocidadErrorKmh: 180,
  maxPuntosRuta: 6000,
  /** ~3 m: tolerancia de la simplificación Douglas-Peucker. */
  toleranciaGrados: 0.00003,
};

const aIso = (ms: number) => new Date(ms).toISOString();
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function distanciaKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371.0088;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Douglas-Peucker iterativo sobre lat/lng (aproximación plana, suficiente para tramos cortos). */
export function simplificar(pts: Punto[], tolerancia: number): Punto[] {
  if (pts.length <= 2) return pts.slice();
  const mantener = new Uint8Array(pts.length);
  mantener[0] = 1;
  mantener[pts.length - 1] = 1;
  const pila: [number, number][] = [[0, pts.length - 1]];
  const tol2 = tolerancia * tolerancia;
  while (pila.length) {
    const [s, e] = pila.pop()!;
    if (e - s < 2) continue;
    const ax = pts[s]!.lng;
    const ay = pts[s]!.lat;
    const dx = pts[e]!.lng - ax;
    const dy = pts[e]!.lat - ay;
    const largo2 = dx * dx + dy * dy;
    let maxD = -1;
    let maxI = -1;
    for (let i = s + 1; i < e; i++) {
      const px = pts[i]!.lng;
      const py = pts[i]!.lat;
      let d2: number;
      if (largo2 === 0) {
        d2 = (px - ax) ** 2 + (py - ay) ** 2;
      } else {
        const u = Math.max(
          0,
          Math.min(1, ((px - ax) * dx + (py - ay) * dy) / largo2),
        );
        d2 = (px - (ax + u * dx)) ** 2 + (py - (ay + u * dy)) ** 2;
      }
      if (d2 > maxD) {
        maxD = d2;
        maxI = i;
      }
    }
    if (maxD > tol2) {
      mantener[maxI] = 1;
      pila.push([s, maxI], [maxI, e]);
    }
  }
  return pts.filter((_, i) => mantener[i]);
}

/**
 * Descarta picos del GPS: puntos que implican una velocidad imposible respecto del último
 * aceptado. Si se rechazan 3 seguidos se acepta el siguiente (la referencia era la errónea).
 */
export function quitarSaltos(
  puntos: Punto[],
  velocidadErrorKmh = PARAMETROS.velocidadErrorKmh,
): Punto[] {
  if (puntos.length < 2) return puntos.slice();
  const salida = [puntos[0]!];
  let rechazados = 0;
  for (const p of puntos.slice(1)) {
    const ref = salida[salida.length - 1]!;
    const horas = (p.t - ref.t) / 3_600_000;
    const d = distanciaKm(ref, p);
    if (d > 1 && horas > 0 && d / horas > velocidadErrorKmh && rechazados < 3) {
      rechazados++;
      continue;
    }
    rechazados = 0;
    salida.push(p);
  }
  return salida;
}

interface Corrida {
  enMovimiento: boolean;
  desde: number;
  hasta: number;
  seg: number;
  km: number;
  segMovimiento: number;
}

function unirVecinas(corridas: Corrida[]): Corrida[] {
  const salida: Corrida[] = [];
  for (const c of corridas) {
    const ultima = salida[salida.length - 1];
    if (ultima && ultima.enMovimiento === c.enMovimiento) {
      ultima.hasta = c.hasta;
      ultima.seg += c.seg;
      ultima.km += c.km;
      ultima.segMovimiento += c.segMovimiento;
    } else {
      salida.push({ ...c });
    }
  }
  return salida;
}

function centro(pts: Punto[]): { lat: number; lng: number } {
  const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
  return { lat: r6(lat), lng: r6(lng) };
}

const velocidadMaxima = (pts: Punto[]) =>
  pts.reduce(
    (max, p) => (p.velocidad <= 200 ? Math.max(max, p.velocidad) : max),
    0,
  );

/** Odómetro válido: existe, no retrocede, avanzó y el salto es razonable. */
function kmOdometro(
  a: Punto,
  b: Punto,
  kmGps: number,
  maximo: number,
): number | null {
  return a.odometro !== null &&
    b.odometro !== null &&
    b.odometro >= a.odometro &&
    b.odometro - a.odometro < maximo &&
    (b.odometro > a.odometro || kmGps < 0.5)
    ? r3(b.odometro - a.odometro)
    : null;
}

export interface AnalisisRecorrido {
  resumen: ResumenRecorridoDto;
  viajes: ViajeRecorridoDto[];
  paradas: ParadaRecorridoDto[];
  ruta: [number, number, number, number][];
}

export function analizarRecorrido(
  crudos: Punto[],
  opciones: Partial<typeof PARAMETROS> = {},
): AnalisisRecorrido {
  const o = { ...PARAMETROS, ...opciones };
  const puntos = quitarSaltos(crudos, o.velocidadErrorKmh);
  const n = puntos.length;
  const resumen: ResumenRecorridoDto = {
    distanciaKm: 0,
    odometroKm: null,
    movimientoSeg: 0,
    detenidoSeg: 0,
    velocidadMax: 0,
    velocidadPromedio: 0,
    viajes: 0,
    paradas: 0,
    puntos: n,
    primero: n ? aIso(puntos[0]!.t) : null,
    ultimo: n ? aIso(puntos[n - 1]!.t) : null,
  };
  if (n === 0) return { resumen, viajes: [], paradas: [], ruta: [] };
  if (n === 1) {
    const p = puntos[0]!;
    return {
      resumen,
      viajes: [],
      paradas: [],
      ruta: [[r6(p.lat), r6(p.lng), Math.round(p.t / 1000), p.velocidad]],
    };
  }

  // 1) Tramos entre posiciones seguidas
  let corridas: Corrida[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = puntos[i]!;
    const b = puntos[i + 1]!;
    const seg = (b.t - a.t) / 1000;
    let km = distanciaKm(a, b);
    const kmh = seg > 0 ? km / (seg / 3600) : Infinity;
    const salto = km > 1 && kmh > o.velocidadErrorKmh;
    if (salto) km = 0;
    const enMovimiento =
      !salto &&
      (km >= o.radioQuietoKm ||
        (seg < 300 &&
          km > 0.02 &&
          (a.velocidad > o.velocidadQuietoKmh ||
            b.velocidad > o.velocidadQuietoKmh)));
    // Un hueco largo sin señal no cuenta entero como conducción: se estima a 40 km/h.
    const segMovimiento = !enMovimiento
      ? 0
      : seg <= 1800
        ? seg
        : Math.min(seg, Math.max(60, (km / 40) * 3600));
    corridas.push({
      enMovimiento,
      desde: i,
      hasta: i + 1,
      seg,
      km,
      segMovimiento,
    });
  }
  corridas = unirVecinas(corridas);

  // 2) Ruido: movimientos mínimos entre dos corridas quietas
  for (const c of corridas) {
    if (c.enMovimiento && c.km < 0.1 && c.seg < 120) {
      c.enMovimiento = false;
      c.segMovimiento = 0;
    }
  }
  corridas = unirVecinas(corridas);
  // 3) Paradas cortas (semáforo, peaje): parte del viaje
  for (const c of corridas) {
    if (!c.enMovimiento && c.seg < o.paradaMinSeg) {
      c.enMovimiento = true;
      c.segMovimiento = c.seg;
    }
  }
  corridas = unirVecinas(corridas);
  // 4) Maniobras: movimiento corto entre dos paradas se funde en una sola parada
  for (let i = 1; i < corridas.length - 1; i++) {
    const c = corridas[i]!;
    if (
      c.enMovimiento &&
      c.km < o.viajeMinKm &&
      !corridas[i - 1]!.enMovimiento &&
      !corridas[i + 1]!.enMovimiento
    ) {
      c.enMovimiento = false;
      c.segMovimiento = 0;
    }
  }
  corridas = unirVecinas(corridas);

  // 5) Ruta simplificada; si supera el tope de puntos, se sube la tolerancia
  const tramos = corridas.map((c) => puntos.slice(c.desde, c.hasta + 1));
  const armarRuta = (tolerancia: number) => {
    const ruta: [number, number, number, number][] = [];
    const agregar = (p: {
      lat: number;
      lng: number;
      t: number;
      velocidad: number;
    }) => {
      const fila: [number, number, number, number] = [
        r6(p.lat),
        r6(p.lng),
        Math.round(p.t / 1000),
        p.velocidad,
      ];
      const ultima = ruta[ruta.length - 1];
      if (
        ultima &&
        ultima[0] === fila[0] &&
        ultima[1] === fila[1] &&
        ultima[2] === fila[2]
      )
        return;
      ruta.push(fila);
    };
    corridas.forEach((c, i) => {
      const seg = tramos[i]!;
      if (c.enMovimiento) {
        for (const p of simplificar(seg, tolerancia)) agregar(p);
      } else {
        const m = centro(seg);
        agregar({ ...m, t: seg[0]!.t, velocidad: 0 });
        agregar({ ...m, t: seg[seg.length - 1]!.t, velocidad: 0 });
      }
    });
    return ruta;
  };
  let tolerancia = o.toleranciaGrados;
  let ruta = armarRuta(tolerancia);
  for (let k = 0; k < 4 && ruta.length > o.maxPuntosRuta; k++) {
    tolerancia *= 2.5;
    ruta = armarRuta(tolerancia);
  }

  // 6) Viajes y paradas
  const viajes: ViajeRecorridoDto[] = [];
  const paradas: ParadaRecorridoDto[] = [];
  corridas.forEach((c, i) => {
    const seg = tramos[i]!;
    const a = seg[0]!;
    const b = seg[seg.length - 1]!;
    if (c.enMovimiento) {
      viajes.push({
        inicio: aIso(a.t),
        fin: aIso(b.t),
        duracionSeg: Math.round(c.seg),
        movimientoSeg: Math.round(c.segMovimiento),
        distanciaKm: r3(c.km),
        odometroKm: kmOdometro(a, b, c.km, 5000),
        velocidadMax: velocidadMaxima(seg),
        velocidadPromedio:
          c.segMovimiento > 0
            ? Math.round((c.km / (c.segMovimiento / 3600)) * 10) / 10
            : 0,
        desde: { lat: r6(a.lat), lng: r6(a.lng) },
        hasta: { lat: r6(b.lat), lng: r6(b.lng) },
      });
    } else {
      paradas.push({
        inicio: aIso(a.t),
        fin: aIso(b.t),
        duracionSeg: Math.round(c.seg),
        ...centro(seg),
        motorApagado:
          seg.filter((p) => p.encendido === 0).length > seg.length / 2,
      });
    }
  });

  // 7) Resumen
  const distancia = viajes.reduce((s, v) => s + v.distanciaKm, 0);
  const movimiento = viajes.reduce((s, v) => s + v.movimientoSeg, 0);
  Object.assign(resumen, {
    distanciaKm: r3(distancia),
    odometroKm: kmOdometro(puntos[0]!, puntos[n - 1]!, distancia, 20000),
    movimientoSeg: Math.round(movimiento),
    detenidoSeg: Math.round(paradas.reduce((s, p) => s + p.duracionSeg, 0)),
    velocidadMax: velocidadMaxima(puntos),
    velocidadPromedio:
      movimiento > 0
        ? Math.round((distancia / (movimiento / 3600)) * 10) / 10
        : 0,
    viajes: viajes.length,
    paradas: paradas.length,
  });
  return { resumen, viajes, paradas, ruta };
}
