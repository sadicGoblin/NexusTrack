# NexusTrack móvil

App Flutter para que el personal de la empresa **consulte** desde el teléfono lo que se registra
en NexusTrack. Usa las mismas cuentas y la misma API que la web; no modifica datos.

| Pantalla | Qué muestra                                                                         |
| -------- | ----------------------------------------------------------------------------------- |
| Inicio   | Indicadores del día, retiros sin orden de carga, cargas por rendir y vencimientos.  |
| Fletes   | Órdenes de retiro (vigentes o por mes), órdenes de carga (por rendir o por mes) y rendiciones. |
| Vales    | Vales de dinero y de combustible por mes, con sus totales.                          |
| Flota    | Qué conductor y qué remolque van con cada camión.                                   |

Cada documento abre su detalle, con enlaces entre ellos (retiro → carga → rendición, vales).

## Requisitos

- Flutter 3.32 o superior (`flutter doctor`).
- Android: Android Studio con su SDK. Teléfonos con Android 6.0 o superior.
- iPhone: macOS con Xcode instalado (no lo está en el equipo donde se creó la app).

## Uso

```bash
cd apps/movil
flutter pub get
flutter run                     # en un teléfono o emulador conectado
flutter test                    # pruebas
flutter analyze                 # revisión de código
```

Por defecto la app usa la API de producción. Para otra API:

```bash
flutter run --dart-define=NT_API_URL=http://192.168.1.10:3100
```

Desde un teléfono, `localhost` es el propio teléfono: use la IP del computador. La API solo
acepta orígenes web de `CORS_ORIGIN`; esto afecta a la versión web, no a Android ni iPhone.

## Instalar en teléfonos

- **Android, prueba rápida:** `flutter build apk --release` genera
  `build/app/outputs/flutter-apk/app-release.apk`, que se puede enviar e instalar directamente.
  Para Google Play hace falta una clave de firma propia (`flutter build appbundle`).
- **iPhone:** requiere Xcode y una cuenta de Apple Developer; se distribuye por TestFlight o App Store.

## Estructura

```
lib/
  config.dart        Dirección de la API (NT_API_URL)
  nucleo/            Cliente de la API, sesión, credenciales cifradas, formatos chilenos
  modelos/           Documentos de la API
  datos/             Repositorio y proveedores de datos (Riverpod)
  componentes/       Tarjetas, listados con período y búsqueda, estados
  pantallas/         Ingreso, inicio, fletes, vales, flota y detalles
test/
  datos/             Respuestas reales de la API usadas en las pruebas
```

## Sesión

El ingreso devuelve un token de acceso (15 minutos) y una cookie de renovación (7 días). La app
guarda la cookie en el almacén cifrado del teléfono y renueva el acceso sin pedir la contraseña
mientras se use al menos una vez por semana. «Cerrar sesión» la borra del teléfono y del servidor.

## Ideas para choferes (pendiente, no implementado)

- Recibir en el teléfono la orden de retiro cuando se emite (notificaciones push con Firebase
  Cloud Messaging), además de la llamada habitual.
- Hacer la rendición desde el teléfono al terminar el flete: viáticos, gastos con foto de la boleta
  y odómetro, para que la oficina solo la revise y apruebe.

Ambas requieren cambios en la API: un rol de chofer vinculado a su ficha de conductor y que solo
vea sus propios fletes, registro de dispositivos y almacenamiento de fotos.
