import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../modelos/modelos.dart';
import 'api.dart';
import 'credenciales.dart';

sealed class EstadoSesion {
  const EstadoSesion();
}

/// Revisando si hay una sesión guardada.
class SesionCargando extends EstadoSesion {
  const SesionCargando();
}

class SinSesion extends EstadoSesion {
  const SinSesion({this.aviso});
  final String? aviso;
}

class ConSesion extends EstadoSesion {
  const ConSesion(this.usuario);
  final Usuario usuario;
}

final credencialesProvider = Provider<Credenciales>((ref) => Credenciales());

final apiProvider = Provider<Api>(
  (ref) => Api(
    credenciales: ref.watch(credencialesProvider),
    alPerderSesion: () => ref.read(sesionProvider.notifier).perdida(),
  ),
);

final sesionProvider = NotifierProvider<SesionNotifier, EstadoSesion>(SesionNotifier.new);

class SesionNotifier extends Notifier<EstadoSesion> {
  Api get _api => ref.read(apiProvider);

  @override
  EstadoSesion build() {
    Future.microtask(restaurar);
    return const SesionCargando();
  }

  Future<void> restaurar() async {
    try {
      final sesion = await _api.renovar();
      state = sesion == null ? const SinSesion() : ConSesion(Usuario.desde(sesion['usuario']));
    } on ErrorApi catch (e) {
      state = SinSesion(aviso: e.mensaje);
    }
  }

  /// Lanza [ErrorApi] con el motivo si no se pudo ingresar.
  Future<void> ingresar(String email, String password) async {
    final sesion = await _api.ingresar(email.trim().toLowerCase(), password);
    state = ConSesion(Usuario.desde(sesion['usuario']));
  }

  Future<void> salir() async {
    await _api.salir();
    state = const SinSesion();
  }

  void perdida() {
    if (state is ConSesion) state = const SinSesion(aviso: 'Su sesión expiró. Ingrese nuevamente.');
  }
}
