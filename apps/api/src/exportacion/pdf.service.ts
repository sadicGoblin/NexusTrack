import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import puppeteer, { type Browser } from 'puppeteer';

/**
 * Genera PDF desde HTML con Chromium sin interfaz. Mantiene un solo navegador abierto y lo
 * reutiliza; si se cae, se vuelve a lanzar en la siguiente solicitud.
 */
@Injectable()
export class PdfService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private navegador?: Promise<Browser>;

  private obtenerNavegador(): Promise<Browser> {
    if (!this.navegador) {
      this.navegador = puppeteer
        .launch({
          headless: true,
          executablePath: process.env['PUPPETEER_EXECUTABLE_PATH'] || undefined,
          args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--font-render-hinting=none',
          ],
        })
        .then((b) => {
          b.on('disconnected', () => {
            this.logger.warn(
              'Chromium se desconectó; se relanzará en la próxima solicitud.',
            );
            this.navegador = undefined;
          });
          return b;
        })
        .catch((err: unknown) => {
          this.navegador = undefined;
          throw err;
        });
    }
    return this.navegador;
  }

  async desdeHtml(html: string, horizontal = false): Promise<Buffer> {
    const navegador = await this.obtenerNavegador();
    const pagina = await navegador.newPage();
    try {
      await pagina.setContent(html, { waitUntil: 'load' });
      const pdf = await pagina.pdf({
        format: 'A4',
        landscape: horizontal,
        printBackground: true,
        margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate:
          '<div style="font-size:8px;width:100%;text-align:center;color:#7b8794;font-family:Arial">Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>',
      });
      return Buffer.from(pdf);
    } finally {
      await pagina.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    const navegador = await this.navegador?.catch(() => undefined);
    await navegador?.close();
  }
}
