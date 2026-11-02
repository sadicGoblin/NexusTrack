import {
  Body,
  Controller,
  Global,
  Injectable,
  Module,
  Post,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import type {
  ColumnaExportacion,
  ExportarTablaInput,
  FormatoExportacion,
  TipoColumna,
} from '@nexustrack/shared';
import { Opcion, Texto } from '../comun/validacion.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ExcelService } from './excel.service.js';
import { PdfService } from './pdf.service.js';
import { htmlDocumento, htmlInforme, htmlListado } from './plantillas.js';
import type {
  ArchivoGenerado,
  DatosEmisor,
  DocumentoImprimible,
  InformeImprimible,
} from './tipos.js';

const TIPOS_COLUMNA: TipoColumna[] = [
  'texto',
  'fecha',
  'pesos',
  'numero',
  'decimal',
  'porcentaje',
  'booleano',
];
const MIME = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const;

class ColumnaDto implements ColumnaExportacion {
  @Texto('Campo', { max: 80 }) campo!: string;
  @Texto('Título', { max: 120 }) titulo!: string;
  @Opcion('Tipo de columna', TIPOS_COLUMNA, { opcional: true })
  tipo?: TipoColumna;
}

class ExportarTablaDto implements ExportarTablaInput {
  @Texto('Título', { max: 120 }) titulo!: string;
  @Texto('Subtítulo', { opcional: true, max: 300 }) subtitulo?: string;
  @Opcion('Formato', ['pdf', 'xlsx']) formato!: FormatoExportacion;
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => ColumnaDto)
  columnas!: ColumnaDto[];
  @IsArray()
  @ArrayMaxSize(20_000, {
    message: 'Se pueden exportar como máximo 20.000 filas.',
  })
  @IsObject({ each: true })
  filas!: Record<string, unknown>[];
  @IsOptional()
  @IsObject()
  totales?: Record<string, unknown>;
}

/** Columnas que caben a tamaño normal en una hoja A4 horizontal; con más, el PDF se achica. */
const COLUMNAS_A4 = 17;

/** Fecha y hora de Chile para el pie de los documentos. */
function ahoraChile(): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return `${p['day']}/${p['month']}/${p['year']} ${p['hour']}:${p['minute']}`;
}

const aNombreArchivo = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

@Injectable()
export class ExportacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly excel: ExcelService,
  ) {}

  async emisor(): Promise<DatosEmisor> {
    const p = Object.fromEntries(
      (await this.prisma.parametro.findMany()).map((x) => [x.clave, x.valor]),
    );
    return {
      nombre: p['EMPRESA_NOMBRE'] || 'NexusTrack',
      rut: p['EMPRESA_RUT'] ?? '',
      direccion: p['EMPRESA_DIRECCION'] ?? '',
      telefono: p['EMPRESA_TELEFONO'] ?? '',
      email: p['EMPRESA_EMAIL'] ?? '',
    };
  }

  async documento(
    doc: DocumentoImprimible,
    formato: FormatoExportacion,
  ): Promise<ArchivoGenerado> {
    const emisor = await this.emisor();
    const contenido =
      formato === 'pdf'
        ? await this.pdf.desdeHtml(htmlDocumento(doc, emisor, ahoraChile()))
        : await this.excel.documento(doc, emisor, ahoraChile());
    return {
      contenido,
      tipo: MIME[formato],
      nombre: `${doc.nombreArchivo}.${formato}`,
    };
  }

  async listado(input: ExportarTablaInput): Promise<ArchivoGenerado> {
    const emisor = await this.emisor();
    const contenido =
      input.formato === 'pdf'
        ? await this.pdf.desdeHtml(
            htmlListado(input, emisor, ahoraChile()),
            input.columnas.length > 7,
            Math.max(0.6, Math.min(1, COLUMNAS_A4 / input.columnas.length)),
          )
        : await this.excel.listado(input, emisor, ahoraChile());
    return {
      contenido,
      tipo: MIME[input.formato],
      nombre: `${aNombreArchivo(input.titulo)}.${input.formato}`,
    };
  }

  async informe(
    informe: InformeImprimible,
    formato: FormatoExportacion,
  ): Promise<ArchivoGenerado> {
    const emisor = await this.emisor();
    const contenido =
      formato === 'pdf'
        ? await this.pdf.desdeHtml(
            htmlInforme(informe, emisor, ahoraChile()),
            informe.columnas.length > 7,
          )
        : await this.excel.informe(informe, emisor, ahoraChile());
    return {
      contenido,
      tipo: MIME[formato],
      nombre: `${aNombreArchivo(informe.nombreArchivo)}.${formato}`,
    };
  }
}

export function aArchivo(a: ArchivoGenerado): StreamableFile {
  return new StreamableFile(a.contenido, {
    type: a.tipo,
    disposition: `attachment; filename="${a.nombre}"`,
    length: a.contenido.length,
  });
}

@ApiTags('Exportación')
@Controller('exportacion')
export class ExportacionController {
  constructor(private readonly servicio: ExportacionService) {}

  /** Exporta las filas que el usuario tiene filtradas en una grilla. */
  @Post('tabla')
  async tabla(@Body() dto: ExportarTablaDto): Promise<StreamableFile> {
    return aArchivo(await this.servicio.listado(dto));
  }
}

@Global()
@Module({
  controllers: [ExportacionController],
  providers: [ExportacionService, PdfService, ExcelService],
  exports: [ExportacionService],
})
export class ExportacionModule {}
