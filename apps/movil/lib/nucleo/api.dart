import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

import '../config.dart';
import 'adaptador.dart';
import 'credenciales.dart';

typedef Json = Map<String, dynamic>;

/// Error con un mensaje listo para mostrar.
class ErrorApi implements Exception {
  const ErrorApi(this.mensaje, {this.estado});
  final String mensaje;
  final int? estado;

  @override
  String toString() => mensaje;
}

const _cookie = 'nt_refresh';

/// Cliente de la API de NexusTrack. Usa el token de acceso (15 minutos) y, cuando vence, lo
/// renueva con la cookie de sesión; si la sesión también venció, avisa con [alPerderSesion].
class Api {
  Api({required this.credenciales, required this.alPerderSesion, Dio? dio})
    : _dio = dio ?? _crearDio();

  final Credenciales credenciales;
  final void Function() alPerderSesion;
  final Dio _dio;
  String? _token;
  Future<Json?>? _renovacion;

  static Dio _crearDio() {
    final dio = Dio(
      BaseOptions(
        baseUrl: '$urlApi/api',
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
      ),
    );
    configurarAdaptador(dio);
    return dio;
  }

  /// Devuelve la sesión (token, usuario) y guarda la cookie de renovación.
  Future<Json> ingresar(String email, String password) async {
    final r = await _ejecutar(
      () => _dio.post<Json>('/auth/login', data: {'email': email, 'password': password}),
    );
    await _guardarCookie(r);
    _token = r.data!['accessToken'] as String;
    return r.data!;
  }

  /// Renueva la sesión guardada; null si no hay o ya venció. Varias llamadas a la vez
  /// comparten la misma renovación.
  Future<Json?> renovar() => _renovacion ??= _renovar().whenComplete(() => _renovacion = null);

  Future<Json?> _renovar() async {
    final cookie = await credenciales.leer();
    if (!kIsWeb && cookie == null) return null;
    try {
      final r = await _dio.post<Json>(
        '/auth/refresh',
        options: Options(headers: {if (cookie != null) 'Cookie': '$_cookie=$cookie'}),
      );
      await _guardarCookie(r);
      _token = r.data!['accessToken'] as String;
      return r.data!;
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        await credenciales.borrar();
        _token = null;
        return null;
      }
      throw _traducir(e);
    }
  }

  Future<void> salir() async {
    try {
      final cookie = await credenciales.leer();
      await _dio.post<void>(
        '/auth/logout',
        options: Options(headers: {if (cookie != null) 'Cookie': '$_cookie=$cookie'}),
      );
    } catch (_) {
      // Aunque el servidor no responda, la sesión se cierra en el teléfono.
    } finally {
      _token = null;
      await credenciales.borrar();
    }
  }

  Future<Json> obtener(String ruta, {Map<String, dynamic>? consulta}) async =>
      (await _autenticado<Json>(ruta, consulta)).data!;

  Future<List<Json>> lista(String ruta, {Map<String, dynamic>? consulta}) async =>
      (await _autenticado<List<dynamic>>(ruta, consulta)).data!.cast<Json>();

  Future<Response<T>> _autenticado<T>(String ruta, Map<String, dynamic>? consulta) async {
    Future<Response<T>> pedir() => _dio.get<T>(
      ruta,
      queryParameters: consulta,
      options: Options(headers: {if (_token != null) 'Authorization': 'Bearer $_token'}),
    );
    try {
      return await pedir();
    } on DioException catch (e) {
      if (e.response?.statusCode != 401) throw _traducir(e);
      if (await renovar() == null) {
        alPerderSesion();
        throw const ErrorApi('Su sesión expiró. Ingrese nuevamente.', estado: 401);
      }
      return _ejecutar(pedir);
    }
  }

  Future<Response<T>> _ejecutar<T>(Future<Response<T>> Function() pedir) async {
    try {
      return await pedir();
    } on DioException catch (e) {
      throw _traducir(e);
    }
  }

  Future<void> _guardarCookie(Response<dynamic> r) async {
    for (final linea in r.headers.map['set-cookie'] ?? const <String>[]) {
      final par = linea.split(';').first.trim();
      if (par.startsWith('$_cookie=')) {
        await credenciales.guardar(par.substring(_cookie.length + 1));
      }
    }
  }

  ErrorApi _traducir(DioException e) {
    final datos = e.response?.data;
    final mensaje = datos is Map ? datos['message'] : null;
    if (mensaje is String && mensaje.isNotEmpty) {
      return ErrorApi(mensaje, estado: e.response?.statusCode);
    }
    if (e.response == null) {
      return const ErrorApi('No se pudo conectar con el servidor. Revise su conexión a internet.');
    }
    return ErrorApi(
      'El servidor respondió con un error (${e.response?.statusCode}).',
      estado: e.response?.statusCode,
    );
  }
}
