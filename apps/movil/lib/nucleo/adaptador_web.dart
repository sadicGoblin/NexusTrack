import 'package:dio/browser.dart';
import 'package:dio/dio.dart';

void configurarAdaptador(Dio dio) =>
    dio.httpClientAdapter = BrowserHttpClientAdapter(withCredentials: true);
