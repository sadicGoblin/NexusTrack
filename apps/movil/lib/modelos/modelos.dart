/// Documentos de la API tal como los muestra la app (solo los campos que se consultan).
library;

typedef Json = Map<String, dynamic>;

extension _Lectura on Json {
  String t(String k) => (this[k] as String?) ?? '';
  String? tn(String k) => this[k] as String?;
  int e(String k) => (this[k] as num?)?.toInt() ?? 0;
  int? en(String k) => (this[k] as num?)?.toInt();
  double d(String k) => (this[k] as num?)?.toDouble() ?? 0;
  double? dn(String k) => (this[k] as num?)?.toDouble();
  bool b(String k) => this[k] == true;
  List<Json> l(String k) => ((this[k] as List?) ?? const []).cast<Json>();
}

class Usuario {
  Usuario.desde(dynamic j)
    : id = (j as Json).e('id'),
      email = j.t('email'),
      nombre = j.t('nombre'),
      rol = j.t('rol');
  final int id;
  final String email, nombre, rol;
}

/// Datos de la orden de retiro que acompañan a los documentos hijos.
class ResumenRetiro {
  ResumenRetiro.desde(Json j)
    : id = j.e('id'),
      numero = j.e('numero'),
      fecha = j.t('fecha'),
      estado = j.t('estado'),
      cliente = j.t('cliente'),
      origen = j.t('origen'),
      destino = j.t('destino'),
      trazabilidad = j.t('trazabilidad'),
      conductor = j.t('conductor'),
      conductorRut = j.t('conductorRut'),
      empresa = j.t('empresa'),
      camion = j.t('camion'),
      remolque = j.tn('remolque'),
      fechaCarga = j.tn('fechaCarga'),
      horaCarga = j.tn('horaCarga'),
      tieneOrdenCarga = j.b('tieneOrdenCarga');
  final int id, numero;
  final String fecha, estado, cliente, origen, destino, trazabilidad, conductor, conductorRut;
  final String empresa, camion;
  final String? remolque, fechaCarga, horaCarga;
  final bool tieneOrdenCarga;
}

class OrdenRetiro {
  OrdenRetiro.desde(Json j)
    : id = j.e('id'),
      numero = j.e('numero'),
      estado = j.t('estado'),
      fecha = j.t('fecha'),
      trazabilidad = j.t('trazabilidad'),
      conductor = j.t('conductor'),
      conductorRut = j.t('conductorRut'),
      camion = j.t('camion'),
      remolque = j.tn('remolque'),
      tipoRemolque = j.tn('tipoRemolque'),
      empresa = j.t('empresa'),
      cliente = j.t('cliente'),
      origen = j.t('origen'),
      destino = j.t('destino'),
      destinoFinal = j.tn('destinoFinal'),
      depositoRetiro = j.tn('depositoRetiro'),
      packingCarga = j.tn('packingCarga'),
      fechaCarga = j.tn('fechaCarga'),
      horaCarga = j.tn('horaCarga'),
      depositoEntrega = j.tn('depositoEntrega'),
      packingEntrega = j.tn('packingEntrega'),
      nave = j.tn('nave'),
      mtb = j.tn('mtb'),
      booking = j.tn('booking'),
      puertoEmbarque = j.tn('puertoEmbarque'),
      fechaEmbarque = j.tn('fechaEmbarque'),
      horaEmbarque = j.tn('horaEmbarque'),
      opNumero = j.tn('opNumero'),
      ordenCompra = j.tn('ordenCompra'),
      observaciones = j.tn('observaciones'),
      motivoAnulacion = j.tn('motivoAnulacion'),
      ordenCargaId = j.en('ordenCargaId'),
      ordenCargaNumero = j.en('ordenCargaNumero'),
      cantidadValesDinero = j.e('cantidadValesDinero'),
      cantidadValesCombustible = j.e('cantidadValesCombustible');
  final int id, numero, cantidadValesDinero, cantidadValesCombustible;
  final int? ordenCargaId, ordenCargaNumero;
  final String estado, fecha, trazabilidad, conductor, conductorRut, camion, empresa, cliente;
  final String origen, destino;
  final String? remolque, tipoRemolque, destinoFinal, depositoRetiro, packingCarga, fechaCarga;
  final String? horaCarga, depositoEntrega, packingEntrega, nave, mtb, booking, puertoEmbarque;
  final String? fechaEmbarque, horaEmbarque, opNumero, ordenCompra, observaciones;
  final String? motivoAnulacion;
}

class Guia {
  Guia.desde(Json j)
    : linea = j.e('linea'),
      numeroGuia = j.t('numeroGuia'),
      fechaGuia = j.t('fechaGuia'),
      especie = j.tn('especie'),
      cantidadEspecie = j.dn('cantidadEspecie'),
      umEspecie = j.tn('umEspecie'),
      numeroContenedor = j.tn('numeroContenedor'),
      tramo = j.t('tramoTexto'),
      cantidadTarifa = j.d('cantidadTarifa'),
      umTarifa = j.tn('umTarifa'),
      valorUnitario = j.e('valorUnitario'),
      total = j.e('total');
  final int linea, valorUnitario, total;
  final String numeroGuia, fechaGuia, tramo;
  final String? especie, umEspecie, numeroContenedor, umTarifa;
  final double? cantidadEspecie;
  final double cantidadTarifa;
}

class OrdenCarga {
  OrdenCarga.desde(Json j)
    : id = j.e('id'),
      numero = j.e('numero'),
      estado = j.t('estado'),
      tramo = j.tn('tramo'),
      fechaCarga = j.t('fechaCarga'),
      horaCarga = j.tn('horaCarga'),
      packingCarga = j.tn('packingCarga'),
      patenteCamion = j.t('patenteCamion'),
      patenteRemolque = j.tn('patenteRemolque'),
      hojaRuta = j.en('hojaRuta'),
      guiasConfirmadas = j.tn('guiasConfirmadas'),
      totalNeto = j.e('totalNeto'),
      observaciones = j.tn('observaciones'),
      motivoAnulacion = j.tn('motivoAnulacion'),
      rendicionId = j.en('rendicionId'),
      rendicionNumero = j.en('rendicionNumero'),
      guias = j.l('guias').map(Guia.desde).toList(),
      retiro = ResumenRetiro.desde(j['retiro'] as Json);
  final int id, numero, totalNeto;
  final int? hojaRuta, rendicionId, rendicionNumero;
  final String estado, fechaCarga, patenteCamion;
  final String? tramo, horaCarga, packingCarga, patenteRemolque, guiasConfirmadas;
  final String? observaciones, motivoAnulacion;
  final List<Guia> guias;
  final ResumenRetiro retiro;
}

class ValeDinero {
  ValeDinero.desde(Json j)
    : id = j.e('id'),
      numero = j.e('numero'),
      estado = j.t('estado'),
      fechaEntrega = j.t('fechaEntrega'),
      concepto = j.tn('concepto'),
      glosa = j.tn('glosa'),
      sitioEntrega = j.t('sitioEntrega'),
      formaPago = j.t('formaPago'),
      monto = j.e('monto'),
      motivoAnulacion = j.tn('motivoAnulacion'),
      retiro = j['retiro'] == null ? null : ResumenRetiro.desde(j['retiro'] as Json),
      estadia = j['estadia'] == null ? null : ResumenEstadia.desde(j['estadia'] as Json);
  final int id, numero, monto;
  final String estado, fechaEntrega, sitioEntrega, formaPago;
  final String? concepto, glosa, motivoAnulacion;
  /// Anticipo de un flete (orden de retiro) o de una estadía: uno de los dos.
  final ResumenRetiro? retiro;
  final ResumenEstadia? estadia;

  String get conductor => retiro?.conductor ?? estadia?.conductor ?? '';
}

/// Estadía a la que apunta un vale de dinero.
class ResumenEstadia {
  ResumenEstadia.desde(Json j)
    : id = j.e('id'),
      numero = j.e('numero'),
      destino = j.t('destino'),
      conductor = j.t('conductor');
  final int id, numero;
  final String destino, conductor;
}

class ValeCombustible {
  ValeCombustible.desde(Json j)
    : id = j.e('id'),
      numero = j.e('numero'),
      estado = j.t('estado'),
      fechaEntrega = j.t('fechaEntrega'),
      horaEntrega = j.tn('horaEntrega'),
      sitioEntrega = j.t('sitioEntrega'),
      formaPago = j.tn('formaPago'),
      tipoDocumento = j.tn('tipoDocumento'),
      camion = j.t('camion'),
      remolque = j.tn('remolque'),
      litrosCamion = j.d('litrosCamion'),
      litrosRemolque = j.d('litrosRemolque'),
      totalLitros = j.d('totalLitros'),
      valorLitro = j.e('valorLitro'),
      total = j.e('total'),
      observaciones = j.tn('observaciones'),
      motivoAnulacion = j.tn('motivoAnulacion'),
      retiro = ResumenRetiro.desde(j['retiro'] as Json);
  final int id, numero, valorLitro, total;
  final String estado, fechaEntrega, sitioEntrega, camion;
  final String? horaEntrega, formaPago, tipoDocumento, remolque, observaciones, motivoAnulacion;
  final double litrosCamion, litrosRemolque, totalLitros;
  final ResumenRetiro retiro;
}

class Viatico {
  Viatico.desde(Json j)
    : fecha = j.t('fecha'),
      desayuno = j.e('desayuno'),
      almuerzo = j.e('almuerzo'),
      comida = j.e('comida'),
      total = j.e('total');
  final String fecha;
  final int desayuno, almuerzo, comida, total;
}

class Gasto {
  Gasto.desde(Json j)
    : tipoDocumento = j.tn('tipoDocumento'),
      numeroDocumento = j.tn('numeroDocumento'),
      rutProveedor = j.tn('rutProveedor'),
      fecha = j.tn('fecha'),
      monto = j.e('monto'),
      item = j.tn('itemGasto'),
      observaciones = j.tn('observaciones');
  final String? tipoDocumento, numeroDocumento, rutProveedor, fecha, item, observaciones;
  final int monto;
}

class Rendicion {
  Rendicion.desde(Json j)
    : id = j.e('id'),
      numero = j.e('numero'),
      estado = j.t('estado'),
      tipo = j.t('tipo'),
      ordenCargaId = j.en('ordenCargaId'),
      ordenCargaNumero = j.en('ordenCargaNumero'),
      conductor = j.t('conductor'),
      origen = j.t('origen'),
      destino = j.t('destino'),
      tramo = j.tn('tramo'),
      patenteCamion = j.t('patenteCamion'),
      patenteRemolque = j.tn('patenteRemolque'),
      fecha = j.t('fecha'),
      fechaSalida = j.tn('fechaSalida'),
      horaSalida = j.tn('horaSalida'),
      fechaLlegada = j.tn('fechaLlegada'),
      horaLlegada = j.tn('horaLlegada'),
      odometroInicial = j.en('odometroInicial'),
      odometroFinal = j.en('odometroFinal'),
      kmRecorridos = j.en('kmRecorridos'),
      observaciones = j.tn('observaciones'),
      sitioEntrega = j.tn('sitioEntrega'),
      peajes = j.e('peajes'),
      carga = j.e('carga'),
      descarga = j.e('descarga'),
      totalViaticos = j.e('totalViaticos'),
      totalOtrosGastos = j.e('totalOtrosGastos'),
      totalGeneral = j.e('totalGeneral'),
      motivoAnulacion = j.tn('motivoAnulacion'),
      viaticos = j.l('viaticos').map(Viatico.desde).toList(),
      gastos = j.l('gastos').map(Gasto.desde).toList(),
      retiro = j['retiro'] == null ? null : ResumenRetiro.desde(j['retiro'] as Json);
  final int id, numero, peajes, carga, descarga;
  final int totalViaticos, totalOtrosGastos, totalGeneral;
  /// Nulos en una estadía (rendición sin orden de carga).
  final int? ordenCargaId, ordenCargaNumero;
  final int? odometroInicial, odometroFinal, kmRecorridos;
  final String estado, tipo, conductor, origen, destino, patenteCamion, fecha;
  final String? tramo, patenteRemolque, fechaSalida, horaSalida, fechaLlegada, horaLlegada;
  final String? observaciones, sitioEntrega, motivoAnulacion;
  final List<Viatico> viaticos;
  final List<Gasto> gastos;
  final ResumenRetiro? retiro;

  bool get esEstadia => tipo == 'ESTADIA';
}

/// Un camión del tablero de asignaciones, con su conductor y remolques vigentes.
class CamionFlota {
  CamionFlota.desde(Json j)
    : camionId = j.e('camionId'),
      camion = j.t('camion'),
      tipo = j.t('camionTipo'),
      empresa = j.t('empresa'),
      conductor = (j['asignacion'] as Json?)?.tn('conductor'),
      chasis = (j['asignacion'] as Json?)?.tn('chasis'),
      thermo = (j['asignacion'] as Json?)?.tn('thermo'),
      plataforma = (j['asignacion'] as Json?)?.tn('plataforma'),
      desde = (j['asignacion'] as Json?)?.tn('fechaAsignacion');
  final int camionId;
  final String camion, tipo, empresa;
  final String? conductor, chasis, thermo, plataforma, desde;

  List<String> get remolques => [chasis, thermo, plataforma].whereType<String>().toList();
  bool get asignado => desde != null;
}

class CargaPorRendir {
  CargaPorRendir.desde(Json j)
    : id = j.e('id'),
      numero = j.e('numero'),
      fechaCarga = j.t('fechaCarga'),
      cliente = j.t('cliente'),
      conductor = j.t('conductor'),
      patenteCamion = j.t('patenteCamion'),
      totalNeto = j.e('totalNeto');
  final int id, numero, totalNeto;
  final String fechaCarga, cliente, conductor, patenteCamion;
}

class Vencimiento {
  Vencimiento.desde(Json j)
    : tipo = j.t('tipo'),
      referencia = j.t('referencia'),
      detalle = j.t('detalle'),
      fecha = j.t('fecha'),
      dias = j.e('dias');
  final String tipo, referencia, detalle, fecha;
  final int dias;
}

class Inicio {
  Inicio.desde(Json j)
    : contadores = ((j['contadores'] as Json?) ?? const {}).map(
        (k, v) => MapEntry(k, (v as num).toDouble()),
      ),
      retirosSinCarga = j.l('retirosSinCarga').map(ResumenRetiro.desde).toList(),
      cargasPorRendir = j.l('cargasPorRendir').map(CargaPorRendir.desde).toList(),
      vencimientos = j.l('vencimientos').map(Vencimiento.desde).toList();
  final Map<String, double> contadores;
  final List<ResumenRetiro> retirosSinCarga;
  final List<CargaPorRendir> cargasPorRendir;
  final List<Vencimiento> vencimientos;
}
