import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nexustrack_movil/modelos/modelos.dart';

/// Respuestas reales de la API, guardadas en test/datos.
dynamic leer(String nombre) => jsonDecode(File('test/datos/$nombre.json').readAsStringSync());

void main() {
  test('lee órdenes de retiro', () {
    final lista = (leer('ordenes-retiro') as List).cast<Json>().map(OrdenRetiro.desde).toList();
    expect(lista, isNotEmpty);
    final o = OrdenRetiro.desde(leer('orden-retiro') as Json);
    expect(o.numero, greaterThan(0));
    expect(o.cliente, isNotEmpty);
    expect(o.conductor, isNotEmpty);
    expect(['ABIERTA', 'CON_CARGA', 'CERRADA', 'ANULADA'], contains(o.estado));
  });

  test('lee una orden de carga con sus guías y la orden de retiro', () {
    final o = OrdenCarga.desde(leer('orden-carga') as Json);
    expect(o.guias, isNotEmpty);
    expect(o.totalNeto, o.guias.fold<int>(0, (s, g) => s + g.total));
    expect(o.retiro.cliente, isNotEmpty);
  });

  test('lee vales de dinero y de combustible', () {
    final dinero = (leer('vales-dinero') as List).cast<Json>().map(ValeDinero.desde).toList();
    expect(dinero.first.monto, greaterThan(0));
    final combustible = (leer('vales-combustible') as List)
        .cast<Json>()
        .map(ValeCombustible.desde)
        .toList();
    expect(combustible.first.totalLitros, greaterThan(0));
    expect(combustible.first.total, greaterThan(0));
  });

  test('lee una rendición con su total general', () {
    final r = Rendicion.desde(leer('rendicion') as Json);
    expect(r.totalGeneral, r.peajes + r.carga + r.descarga + r.totalViaticos + r.totalOtrosGastos);
  });

  test('lee una estadía y su vale, sin orden de carga ni de retiro', () {
    final r = Rendicion.desde({
      ...leer('rendicion') as Json,
      'tipo': 'ESTADIA',
      'ordenCargaId': null,
      'ordenCargaNumero': null,
      'retiro': null,
      'conductor': 'LUIS ENRIQUE GAETE PINO',
      'origen': 'ESTADÍA',
      'destino': 'SAN ANTONIO',
    });
    expect(r.esEstadia, isTrue);
    expect(r.retiro, isNull);
    expect(r.ordenCargaId, isNull);
    final v = ValeDinero.desde({
      ...(leer('vales-dinero') as List).cast<Json>().first,
      'retiro': null,
      'estadia': {'id': 3, 'numero': 7, 'destino': 'SAN ANTONIO', 'conductor': 'LUIS ENRIQUE GAETE PINO'},
    });
    expect(v.retiro, isNull);
    expect(v.conductor, 'LUIS ENRIQUE GAETE PINO');
  });

  test('lee la flota, con y sin asignación', () {
    final flota = (leer('flota') as List).cast<Json>().map(CamionFlota.desde).toList();
    expect(flota.where((c) => c.asignado), isNotEmpty);
    expect(flota.where((c) => !c.asignado), isNotEmpty);
    expect(flota.firstWhere((c) => c.asignado).remolques, isNotEmpty);
  });

  test('lee el resumen de inicio', () {
    final inicio = Inicio.desde(leer('inicio') as Json);
    expect(inicio.contadores.keys, contains('retirosAbiertos'));
  });
}
