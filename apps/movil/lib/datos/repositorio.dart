import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../modelos/modelos.dart';
import '../nucleo/api.dart';
import '../nucleo/formato.dart';
import '../nucleo/sesion.dart';

/// Qué traer en un listado: lo vigente (o pendiente) o lo de un mes.
typedef Consulta = ({bool vigentes, int anio, int mes});

Consulta consultaInicial({bool vigentes = false}) {
  final hoy = DateTime.now();
  return (vigentes: vigentes, anio: hoy.year, mes: hoy.month);
}

Map<String, dynamic> _delMes(Consulta c) {
  final r = rangoMes(c.anio, c.mes);
  return {'desde': r.desde, 'hasta': r.hasta};
}

/// Consultas de solo lectura a la API.
class Repositorio {
  Repositorio(this._api);
  final Api _api;

  Future<Inicio> inicio() async => Inicio.desde(await _api.obtener('/inicio'));

  Future<List<OrdenRetiro>> ordenesRetiro(Consulta c) async => (await _api.lista(
    '/ordenes-retiro',
    consulta: c.vigentes ? {'activas': true} : _delMes(c),
  )).map(OrdenRetiro.desde).toList();

  Future<OrdenRetiro> ordenRetiro(int id) async =>
      OrdenRetiro.desde(await _api.obtener('/ordenes-retiro/$id'));

  Future<List<OrdenCarga>> ordenesCarga(Consulta c) async => (await _api.lista(
    '/ordenes-carga',
    consulta: c.vigentes ? {'estado': 'ABIERTA'} : _delMes(c),
  )).map(OrdenCarga.desde).toList();

  Future<OrdenCarga> ordenCarga(int id) async =>
      OrdenCarga.desde(await _api.obtener('/ordenes-carga/$id'));

  Future<List<ValeDinero>> valesDinero(Consulta c) async =>
      (await _api.lista('/vales-dinero', consulta: _delMes(c))).map(ValeDinero.desde).toList();

  Future<ValeDinero> valeDinero(int id) async =>
      ValeDinero.desde(await _api.obtener('/vales-dinero/$id'));

  Future<List<ValeCombustible>> valesCombustible(Consulta c) async => (await _api.lista(
    '/vales-combustible',
    consulta: _delMes(c),
  )).map(ValeCombustible.desde).toList();

  Future<ValeCombustible> valeCombustible(int id) async =>
      ValeCombustible.desde(await _api.obtener('/vales-combustible/$id'));

  Future<List<Rendicion>> rendiciones(Consulta c) async =>
      (await _api.lista('/rendiciones', consulta: _delMes(c))).map(Rendicion.desde).toList();

  Future<Rendicion> rendicion(int id) async =>
      Rendicion.desde(await _api.obtener('/rendiciones/$id'));

  Future<List<ValeDinero>> valesDineroDeRetiro(int id) async => (await _api.lista(
    '/vales-dinero',
    consulta: {'ordenRetiroId': id},
  )).map(ValeDinero.desde).toList();

  Future<List<ValeCombustible>> valesCombustibleDeRetiro(int id) async => (await _api.lista(
    '/vales-combustible',
    consulta: {'ordenRetiroId': id},
  )).map(ValeCombustible.desde).toList();

  Future<List<CamionFlota>> flota() async =>
      (await _api.lista('/asignaciones/tablero')).map(CamionFlota.desde).toList();
}

final repositorioProvider = Provider<Repositorio>((ref) => Repositorio(ref.watch(apiProvider)));

Repositorio _repo(Ref ref) => ref.watch(repositorioProvider);

final inicioProvider = FutureProvider.autoDispose<Inicio>((ref) => _repo(ref).inicio());

final retirosProvider = FutureProvider.autoDispose.family<List<OrdenRetiro>, Consulta>(
  (ref, c) => _repo(ref).ordenesRetiro(c),
);
final retiroProvider = FutureProvider.autoDispose.family<OrdenRetiro, int>(
  (ref, id) => _repo(ref).ordenRetiro(id),
);

final cargasProvider = FutureProvider.autoDispose.family<List<OrdenCarga>, Consulta>(
  (ref, c) => _repo(ref).ordenesCarga(c),
);
final cargaProvider = FutureProvider.autoDispose.family<OrdenCarga, int>(
  (ref, id) => _repo(ref).ordenCarga(id),
);

final valesDineroProvider = FutureProvider.autoDispose.family<List<ValeDinero>, Consulta>(
  (ref, c) => _repo(ref).valesDinero(c),
);
final valeDineroProvider = FutureProvider.autoDispose.family<ValeDinero, int>(
  (ref, id) => _repo(ref).valeDinero(id),
);

final valesCombustibleProvider = FutureProvider.autoDispose.family<List<ValeCombustible>, Consulta>(
  (ref, c) => _repo(ref).valesCombustible(c),
);
final valeCombustibleProvider = FutureProvider.autoDispose.family<ValeCombustible, int>(
  (ref, id) => _repo(ref).valeCombustible(id),
);

final rendicionesProvider = FutureProvider.autoDispose.family<List<Rendicion>, Consulta>(
  (ref, c) => _repo(ref).rendiciones(c),
);
final rendicionProvider = FutureProvider.autoDispose.family<Rendicion, int>(
  (ref, id) => _repo(ref).rendicion(id),
);

final flotaProvider = FutureProvider.autoDispose<List<CamionFlota>>((ref) => _repo(ref).flota());

final valesDineroDeRetiroProvider = FutureProvider.autoDispose.family<List<ValeDinero>, int>(
  (ref, id) => _repo(ref).valesDineroDeRetiro(id),
);
final valesCombustibleDeRetiroProvider = FutureProvider.autoDispose
    .family<List<ValeCombustible>, int>((ref, id) => _repo(ref).valesCombustibleDeRetiro(id));
