import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nexustrack_movil/nucleo/api.dart';
import 'package:nexustrack_movil/nucleo/credenciales.dart';

/// Almacén en memoria en lugar del cifrado del teléfono.
class _CredencialesEnMemoria extends Credenciales {
  String? valor;
  @override
  Future<String?> leer() async => valor;
  @override
  Future<void> guardar(String v) async => valor = v;
  @override
  Future<void> borrar() async => valor = null;
}

/// Servidor simulado: registra cada pedido y responde según la ruta.
class _Servidor implements HttpClientAdapter {
  _Servidor(this.responder);
  final ResponseBody Function(RequestOptions pedido, int intento) responder;
  final pedidos = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions o,
    Stream<Uint8List>? cuerpo,
    Future<void>? cancelar,
  ) async {
    pedidos.add(o);
    return responder(o, pedidos.where((p) => p.path == o.path).length);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody respuesta(int estado, Object datos, {String? cookie}) => ResponseBody.fromString(
  jsonEncode(datos),
  estado,
  headers: {
    Headers.contentTypeHeader: ['application/json'],
    if (cookie != null)
      'set-cookie': ['nt_refresh=$cookie; Max-Age=604800; Path=/api/auth; HttpOnly'],
  },
);

Map<String, Object> sesion(String token) => {
  'accessToken': token,
  'expiraEn': 900,
  'usuario': {'id': 1, 'email': 'a@b.cl', 'nombre': 'Ana', 'rol': 'LECTURA'},
};

({Api api, _CredencialesEnMemoria credenciales, _Servidor servidor, List<int> perdidas}) crear(
  ResponseBody Function(RequestOptions, int) responder,
) {
  final credenciales = _CredencialesEnMemoria();
  final servidor = _Servidor(responder);
  final perdidas = <int>[];
  final dio = Dio(BaseOptions(baseUrl: 'https://api.prueba/api'))..httpClientAdapter = servidor;
  final api = Api(credenciales: credenciales, alPerderSesion: () => perdidas.add(1), dio: dio);
  return (api: api, credenciales: credenciales, servidor: servidor, perdidas: perdidas);
}

void main() {
  test('al ingresar guarda la cookie de renovación y usa el token', () async {
    final c = crear(
      (o, _) => o.path == '/auth/login'
          ? respuesta(201, sesion('T1'), cookie: 'abc')
          : respuesta(200, {'ok': true}),
    );
    await c.api.ingresar('a@b.cl', 'clave');
    expect(c.credenciales.valor, 'abc');
    await c.api.obtener('/inicio');
    expect(c.servidor.pedidos.last.headers['Authorization'], 'Bearer T1');
  });

  test('si el token venció, renueva con la cookie y repite la consulta', () async {
    final c = crear(
      (o, intento) => switch (o.path) {
        '/auth/refresh' => respuesta(201, sesion('T2'), cookie: 'def'),
        _ =>
          intento == 1
              ? respuesta(401, {'message': 'No autorizado'})
              : respuesta(200, {'ok': true}),
      },
    );
    c.credenciales.valor = 'abc';
    expect(await c.api.obtener('/inicio'), {'ok': true});
    final renovacion = c.servidor.pedidos.firstWhere((p) => p.path == '/auth/refresh');
    expect(renovacion.headers['Cookie'], 'nt_refresh=abc');
    expect(c.servidor.pedidos.last.headers['Authorization'], 'Bearer T2');
    expect(c.credenciales.valor, 'def');
    expect(c.perdidas, isEmpty);
  });

  test('si la sesión también venció, la borra y avisa', () async {
    final c = crear((o, _) => respuesta(401, {'message': 'Sesión expirada'}));
    c.credenciales.valor = 'abc';
    await expectLater(
      c.api.obtener('/inicio'),
      throwsA(isA<ErrorApi>().having((e) => e.estado, 'estado', 401)),
    );
    expect(c.credenciales.valor, isNull);
    expect(c.perdidas, [1]);
  });

  test('muestra el mensaje de la API o uno claro si no hay conexión', () async {
    final conMensaje = crear(
      (o, _) => respuesta(400, {'message': 'Correo o contraseña incorrectos.'}),
    );
    await expectLater(
      conMensaje.api.ingresar('a@b.cl', 'mala'),
      throwsA(
        isA<ErrorApi>().having((e) => e.mensaje, 'mensaje', 'Correo o contraseña incorrectos.'),
      ),
    );

    final sinRed = crear(
      (o, _) => throw DioException.connectionError(requestOptions: o, reason: 'Sin red'),
    );
    await expectLater(
      sinRed.api.ingresar('a@b.cl', 'clave'),
      throwsA(isA<ErrorApi>().having((e) => e.mensaje, 'mensaje', contains('No se pudo conectar'))),
    );
  });

  test('varias consultas a la vez comparten una sola renovación', () async {
    var renovaciones = 0;
    final c = crear((o, _) {
      if (o.path == '/auth/refresh') {
        renovaciones++;
        return respuesta(201, sesion('T2'), cookie: 'def');
      }
      return o.headers['Authorization'] == 'Bearer T2'
          ? respuesta(200, {'ok': true})
          : respuesta(401, {'message': 'No autorizado'});
    });
    c.credenciales.valor = 'abc';
    await Future.wait([c.api.obtener('/a'), c.api.obtener('/b'), c.api.obtener('/c')]);
    expect(renovaciones, 1);
  });
}
