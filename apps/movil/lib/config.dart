/// Dirección pública de la API, sin `/api`. Se puede cambiar al compilar:
/// `flutter build apk --dart-define=NT_API_URL=https://api.ejemplo.cl`.
const String urlApi = String.fromEnvironment(
  'NT_API_URL',
  defaultValue: 'https://nexustrack-api.2-25-132-42.sslip.io',
);
