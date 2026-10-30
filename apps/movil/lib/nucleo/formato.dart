import 'package:intl/intl.dart';

// En Chile el signo va adelante ($150.000); el formato de moneda de es_CL lo pone al final.
final _pesos = NumberFormat(r'$#,##0', 'es_CL');

/// $150.000
String pesos(num? valor) => valor == null ? '—' : _pesos.format(valor);

/// 1.234 o 1.234,50
String numero(num? valor, {int decimales = 0}) => valor == null
    ? '—'
    : NumberFormat.decimalPatternDigits(locale: 'es_CL', decimalDigits: decimales).format(valor);

final _litros = NumberFormat.decimalPattern('es_CL')..maximumFractionDigits = 2;

/// Litros con hasta 2 decimales, sin ceros sobrantes: 250 L, 250,5 L.
String litros(num? valor) => valor == null ? '—' : '${_litros.format(valor)} L';

/// N° de documento con 6 dígitos: 000123.
String correlativo(int? n) => n == null ? '—' : n.toString().padLeft(6, '0');

/// AAAA-MM-DD (o un ISO completo) a DD/MM/AAAA, sin pasar por zonas horarias.
String fecha(String? iso) {
  if (iso == null || iso.length < 10) return '—';
  final p = iso.substring(0, 10).split('-');
  return '${p[2]}/${p[1]}/${p[0]}';
}

String fechaHora(String? iso, String? hora) =>
    hora == null || hora.isEmpty ? fecha(iso) : '${fecha(iso)} ${hora.substring(0, 5)}';

/// Texto o guion si está vacío.
String texto(String? valor) => valor == null || valor.trim().isEmpty ? '—' : valor;

const _meses = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

String nombreMes(int anio, int mes) => '${_meses[mes - 1]} $anio';

/// Primer y último día de un mes como AAAA-MM-DD.
({String desde, String hasta}) rangoMes(int anio, int mes) {
  String iso(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  return (desde: iso(DateTime(anio, mes, 1)), hasta: iso(DateTime(anio, mes + 1, 0)));
}

String saludo(DateTime ahora) => ahora.hour < 12
    ? 'Buenos días'
    : ahora.hour < 20
    ? 'Buenas tardes'
    : 'Buenas noches';

const etiquetasEstado = {
  'ABIERTA': 'Abierta',
  'CON_CARGA': 'Con carga',
  'CERRADA': 'Cerrada',
  'ANULADA': 'Anulada',
  'RENDIDA': 'Rendida',
  'EMITIDO': 'Emitido',
  'ANULADO': 'Anulado',
};

const etiquetasRol = {
  'ADMIN': 'Administrador',
  'OPERACIONES': 'Operaciones',
  'FINANZAS': 'Finanzas',
  'LECTURA': 'Solo lectura',
};
