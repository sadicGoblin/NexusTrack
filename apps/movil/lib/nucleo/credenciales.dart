import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Guarda la cookie que renueva la sesión (válida 7 días) en el almacén cifrado del teléfono.
/// En la web la guarda el propio navegador, sin que la app pueda leerla.
class Credenciales {
  Credenciales([FlutterSecureStorage? almacen])
    : _almacen = almacen ?? const FlutterSecureStorage();

  static const _clave = 'nt_refresh';
  final FlutterSecureStorage _almacen;

  Future<String?> leer() async => kIsWeb ? null : _almacen.read(key: _clave);

  Future<void> guardar(String valor) async {
    if (!kIsWeb) await _almacen.write(key: _clave, value: valor);
  }

  Future<void> borrar() async {
    if (!kIsWeb) await _almacen.delete(key: _clave);
  }
}
