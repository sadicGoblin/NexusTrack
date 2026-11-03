import { expect, test } from '@playwright/test';
import { elegir, escribirNumero, ingresar } from './ayudas';

test.describe.configure({ mode: 'serial' });

test('flujo completo de un flete: asignación → retiro → carga → vale → rendición', async ({ page }) => {
  await ingresar(page);
  await expect(page.getByRole('heading', { name: /Buen(os|as) (días|tardes|noches)/ })).toBeVisible();

  // 1. Asignación: el conductor Fernando toma el camión DRXR59 con el chasis JH7077.
  await page.goto('/mantenedores/asignaciones');
  await page.getByRole('row', { name: /DRXR59/ }).click();
  await elegir(page, 'a-conductor', 'FERNANDO');
  await elegir(page, 'a-chasis', 'JH7077');
  await page.getByRole('button', { name: 'Guardar asignación' }).click();
  await expect(page.getByRole('row', { name: /DRXR59.*FERNANDO.*JH7077/ })).toBeVisible();

  // 2. Orden de retiro: al elegir el conductor se completan empresa, camión y remolque.
  await page.goto('/operacion/ordenes-retiro/nuevo');
  await elegir(page, 'c-trazabilidadId', 'DEPÓSITO-PLANTA-PUERTO');
  await elegir(page, 'c-clienteId', 'COEXCA');
  await elegir(page, 'c-origenId', 'TALCA');
  await elegir(page, 'c-destinoId', 'VALPARAISO');
  await elegir(page, 'c-conductorId', 'FERNANDO');
  await expect(page.locator('#c-camionId')).toContainText('DRXR59');
  await expect(page.locator('#c-remolqueId')).toContainText('JH7077');
  await expect(page.locator('#c-empresaId')).toContainText('TRANSPORTES B&B LIMITADA');
  await expect(page.locator('#c-tipoRemolque')).toHaveValue('CHASIS C/MOTOR');
  await elegir(page, 'c-packingCargaId', 'MAULE');
  await page.getByRole('button', { name: 'Emitir' }).click();
  await expect(page.getByRole('heading', { name: /Orden de retiro\s+N° 000001/ })).toBeVisible();
  const idRetiro = page.url().split('/').pop();

  // 3. Orden de carga: el tramo propone el valor de la tarifa y se asigna la hoja de ruta.
  await page.getByRole('button', { name: 'Crear orden de carga' }).click();
  await expect(page).toHaveURL(/ordenes-carga\/nuevo\?retiro=/);
  // Las tarifas de la planilla vencieron en 2022: se listan igual, con un aviso al elegirlas.
  await elegir(page, 'c-tramoId', 'TALCA - VALPARAISO - CONTENEDOR');
  await expect(page.getByText('La tarifa de este tramo venció el 31/12/2022')).toBeVisible();
  const guia = page.locator('.tabla-lineas tbody tr').first();
  await guia.getByLabel('N° guía').fill('7349');
  await guia.getByLabel('N° contenedor').fill('BUN38483483');
  await expect(guia).toContainText('$565.000');
  await page.getByRole('button', { name: 'Emitir' }).click();
  await expect(page.getByRole('heading', { name: /Orden de carga\s+N° 000001/ })).toBeVisible();
  await expect(page.getByText('Hoja de ruta N° 000001', { exact: true })).toBeVisible();

  // 4. Vale de dinero (anticipo) para la misma orden de retiro.
  await page.goto(`/operacion/vales-dinero/nuevo?retiro=${idRetiro}`);
  await elegir(page, 'c-sitioEntregaId', 'CURICO');
  await elegir(page, 'c-formaPagoId', 'EFECTIVO');
  await escribirNumero(page.locator('#c-monto'), '150000');
  await page.getByRole('button', { name: 'Emitir' }).click();
  await expect(page.getByRole('heading', { name: /Vale de dinero\s+N° 000001/ })).toBeVisible();

  // 5. Rendición: se elige la orden de carga por rendir y los totales se calculan en vivo.
  await page.goto('/operacion/rendiciones/nuevo');
  await page
    .getByRole('row', { name: /000001/ })
    .first()
    .click();
  await escribirNumero(page.locator('#c-odometroInicial'), '120000');
  await escribirNumero(page.locator('#c-odometroFinal'), '120374');
  await expect(page.locator('#c-kmRecorridos')).toHaveValue('374 km');
  await escribirNumero(page.locator('#c-horometroInicial'), '1520,5');
  await escribirNumero(page.locator('#c-horometroFinal'), '1532,8');
  await expect(page.locator('#c-horasMotor')).toHaveValue('12,3 h');
  await page.getByRole('button', { name: 'Con motor' }).click();
  await escribirNumero(page.locator('#c-peajes'), '12000');
  await escribirNumero(page.locator('#c-petroleo'), '20000');
  await page.getByRole('button', { name: 'Agregar día' }).click();
  await escribirNumero(page.getByLabel('Almuerzo'), '6000');
  await expect(page.locator('.total.principal').last()).toContainText('$38.000');
  await page.getByRole('button', { name: 'Emitir' }).click();
  await expect(page.getByRole('heading', { name: /Rendición de fletes\s+N° 000001/ })).toBeVisible();

  // La cuenta del conductor: anticipo $150.000 y gastos $38.000 → $112.000 a favor.
  const cuenta = page.locator('nt-cuenta-conductor');
  await expect(cuenta).toContainText('vale N° 000001');
  await expect(cuenta.locator('.linea.total')).toContainText('a favor del conductor');
  await expect(cuenta.locator('.linea.total')).toContainText('$112.000');
  await expect(page.getByRole('button', { name: 'Con motor' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Eliminar' })).toBeVisible();

  // 6. El documento se descarga en PDF.
  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF' }).click();
  expect((await descarga).suggestedFilename()).toBe('rendicion-000001.pdf');

  // 7. La orden de retiro queda cerrada y lista sus documentos.
  await page.goto(`/operacion/ordenes-retiro/${idRetiro}`);
  await expect(page.getByText('Flete cerrado')).toBeVisible();
  await expect(page.getByRole('link', { name: 'N° 000001' }).first()).toBeVisible();

  // 8. La cuenta del conductor y la auditoría lo reflejan.
  await page.goto('/operacion/cuentas-conductores');
  await page.getByRole('row', { name: /FERNANDO/ }).click();
  await expect(page.getByText('Saldo · a favor del conductor')).toBeVisible();
  await page.goto('/administracion/auditoria');
  await expect(page.getByRole('row', { name: /Creó.*Rendición.*N° 000001/ }).first()).toBeVisible();
});

test('los informes muestran el flete del mes y la rendición abre su recorrido GPS', async ({ page }) => {
  await ingresar(page);
  // Control de fletes: el flete rendido del mes con sus costos, margen y exportación.
  await page.goto('/informes/control-fletes');
  await expect(page.getByText('Rendidos (1)')).toBeVisible();
  await expect(page.getByRole('row', { name: /FERNANDO/ })).toBeVisible();
  await expect(page.locator('.cifra').first()).toContainText('$565.000');
  const control = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF' }).click();
  expect((await control).suggestedFilename()).toBe('control-de-fletes.pdf');

  // Órdenes por facturar: total por cliente y, al elegirlo, su informe.
  await page.goto('/informes/facturacion');
  await page.getByRole('row', { name: /COEXCA/ }).click();
  await expect(page.getByText('Informe órdenes de carga por facturar')).toBeVisible();
  await expect(page.getByRole('row', { name: /7349/ })).toBeVisible();
  const informe = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF' }).click();
  expect((await informe).suggestedFilename()).toMatch(/^por-facturar-coexca-s-a-.*\.pdf$/);

  // Trazabilidad sin salir de la rendición: en pruebas no hay clave de fm-track y lo avisa.
  await page.goto('/operacion/rendiciones');
  await page
    .getByRole('row', { name: /000001/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Trazabilidad' }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.getByText('El GPS no está configurado')).toBeVisible();
  await page.keyboard.press('Escape');

  // Trazabilidad de cualquier unidad, desde el menú.
  await page.getByRole('link', { name: 'Trazabilidad' }).click();
  await expect(page.getByRole('heading', { name: 'Trazabilidad' })).toBeVisible();
  await expect(page.getByText('El GPS no está configurado')).toBeVisible();
  await expect(page.getByText('Elija una unidad para ver su recorrido.')).toBeVisible();
});

test('una estadía se rinde sin orden de carga, recibe su anticipo y tiene hoja de ruta', async ({ page }) => {
  await ingresar(page);
  await page.goto('/operacion/estadias/nuevo');
  // El camión y el remolque salen de la asignación vigente del conductor.
  await elegir(page, 'c-conductorId', 'FERNANDO');
  await expect(page.locator('#c-camionId')).toContainText('DRXR59');
  await elegir(page, 'c-destinoId', 'SAN ANTONIO');
  await page.getByRole('button', { name: 'Agregar día' }).click();
  await escribirNumero(page.getByLabel('Almuerzo'), '8000');
  await page.getByRole('button', { name: 'Emitir' }).click();
  await expect(page.getByRole('heading', { name: /Rendición de estadía\s+N° 000002/ })).toBeVisible();
  const hoja = page.getByRole('link', { name: /Hoja de ruta N°/ });
  await expect(hoja).toBeVisible();

  // Anticipo de la estadía: vale de dinero que la apunta.
  await page.getByRole('button', { name: 'Entregar anticipo' }).click();
  await expect(page.getByRole('heading', { name: /Estadía N° 000002/ })).toBeVisible();
  await elegir(page, 'c-sitioEntregaId', 'CURICO');
  await elegir(page, 'c-formaPagoId', 'EFECTIVO');
  await escribirNumero(page.locator('#c-monto'), '20000');
  await page.getByRole('button', { name: 'Emitir' }).click();
  await expect(page.getByRole('heading', { name: /Vale de dinero\s+N° 000002/ })).toBeVisible();
  await expect(page.locator('nt-cuenta-conductor')).toContainText('Anticipos de esta estadía');

  // Hojas de ruta: el flete y la estadía, con su origen «ESTADÍA».
  await page.goto('/operacion/hojas-ruta');
  await expect(page.getByText('Todas (2)')).toBeVisible();
  await page.getByRole('row', { name: /ESTADÍA.*SAN ANTONIO/ }).click();
  await expect(page.getByRole('heading', { name: /Hoja de ruta\s+N°/ })).toBeVisible();
  await expect(page.getByText('Rendición de estadía').or(page.getByText('Estadía N° 000002'))).toBeVisible();
  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF' }).click();
  expect((await descarga).suggestedFilename()).toMatch(/^hoja-ruta-\d{6}\.pdf$/);
});

test('los botones de estado filtran el listado con un clic y se recuerdan', async ({ page }) => {
  await ingresar(page);
  await page.goto('/operacion/ordenes-retiro');
  const estados = page.locator('p-selectbutton.estados');
  const filas = page.locator('nt-tabla tbody tr');
  await expect(estados.getByText('Cerrada (1)')).toBeVisible();
  await estados.getByText('Abierta (0)').click();
  await expect(filas).toHaveCount(1); // fila de «sin registros»
  await expect(page.getByRole('row', { name: /000001/ })).toHaveCount(0);
  await estados.getByText('Cerrada (1)').click();
  await expect(page.getByRole('row', { name: /000001/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('row', { name: /000001/ })).toBeVisible();
  await estados.getByText(/^Todas/).click();
});

test('la grilla filtra como planilla y exporta lo filtrado a Excel', async ({ page }) => {
  await ingresar(page);
  await page.goto('/mantenedores/moviles');
  await expect(page.getByText('5 registros')).toBeVisible();
  await page.getByPlaceholder('Buscar en todas las columnas').fill('chasis');
  await expect(page.getByText('2 de 5 registros')).toBeVisible();
  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Excel' }).click();
  expect((await descarga).suggestedFilename()).toBe('moviles.xlsx');
});

test('el orden y los filtros por columna se activan con un interruptor que se recuerda', async ({ page }) => {
  await ingresar(page);
  await page.goto('/mantenedores/moviles');
  const interruptor = page.getByRole('switch', { name: 'Ordenar y filtrar' });
  const botonesFiltro = page.locator('.p-datatable-column-filter-button');
  const patentes = page.locator('.p-datatable-tbody tr td:first-child');
  const patente = page.getByRole('columnheader', { name: /Patente/ });
  await expect(page.getByText('5 registros')).toBeVisible();
  const original = await patentes.allTextContents();

  // Apagado por defecto: encabezados limpios y sin ordenar al hacer clic.
  await expect(interruptor).not.toBeChecked();
  await expect(botonesFiltro).toHaveCount(0);
  await patente.click();
  expect(await patentes.allTextContents()).toEqual(original);

  await interruptor.click();
  await expect(botonesFiltro.first()).toBeVisible();
  await patente.click();
  await patente.click();
  await expect(patentes.first()).toHaveText([...original].sort().reverse()[0]);

  // Al apagarlo se quitan el orden y los filtros: vuelve el orden original.
  await interruptor.click();
  await expect(botonesFiltro).toHaveCount(0);
  expect(await patentes.allTextContents()).toEqual(original);

  await interruptor.click();
  await page.reload();
  await expect(interruptor).toBeChecked();
});

test('un usuario de solo lectura no ve acciones de edición ni administración', async ({ page }) => {
  await ingresar(page);
  await page.goto('/administracion/usuarios');
  await page.getByRole('button', { name: 'Nuevo usuario' }).click();
  await page.locator('#c-nombre').fill('Consulta Pruebas');
  await page.locator('#c-email').fill('consulta@pruebas.cl');
  await elegir(page, 'c-rol', 'Solo lectura');
  await page.locator('#c-password').fill('Consulta123');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('row', { name: /consulta@pruebas.cl/ })).toBeVisible();

  await page.getByRole('button', { name: /Administrador/ }).click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login/);
  await ingresar(page, 'consulta@pruebas.cl', 'Consulta123');
  await expect(page.getByRole('link', { name: 'Usuarios' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Nueva orden de retiro' })).toHaveCount(0);
  await page.goto('/operacion/ordenes-retiro');
  await expect(page.getByRole('heading', { name: 'Órdenes de retiro' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nueva orden de retiro' })).toHaveCount(0);
  await page
    .getByRole('row', { name: /000001/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: /Orden de retiro\s+N° 000001/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Eliminar' })).toHaveCount(0);
});
