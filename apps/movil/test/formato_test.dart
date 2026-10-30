import 'package:flutter_test/flutter_test.dart';
import 'package:nexustrack_movil/componentes/listado.dart';
import 'package:nexustrack_movil/nucleo/formato.dart';

void main() {
  test('formatea pesos, números y correlativos como en Chile', () {
    expect(pesos(150000), r'$150.000');
    expect(pesos(null), '—');
    expect(numero(1234.5, decimales: 2), '1.234,50');
    expect(correlativo(2), '000002');
    expect(litros(250), '250 L');
    expect(litros(250.5), '250,5 L');
  });

  test('convierte fechas ISO sin pasar por zonas horarias', () {
    expect(fecha('2026-10-30'), '30/10/2026');
    expect(fecha('2026-10-30T23:59:00.000Z'), '30/10/2026');
    expect(fechaHora('2026-10-31', '07:00:00'), '31/10/2026 07:00');
    expect(fecha(null), '—');
  });

  test('calcula el rango de un mes, incluso febrero bisiesto', () {
    expect(rangoMes(2028, 2), (desde: '2028-02-01', hasta: '2028-02-29'));
    expect(rangoMes(2026, 12), (desde: '2026-12-01', hasta: '2026-12-31'));
    expect(nombreMes(2026, 10), 'Octubre 2026');
  });

  test('busca sin distinguir mayúsculas ni tildes', () {
    expect(normalizarBusqueda('VALPARAÍSO Ñuñoa'), 'valparaiso nunoa');
  });
}
