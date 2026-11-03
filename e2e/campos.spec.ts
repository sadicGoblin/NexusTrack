import { expect, test, type Locator } from '@playwright/test';
import { ingresar } from './ayudas';

const hoy = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'America/Santiago',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
  .format(new Date())
  .replace(/-/g, '/');

test('el botón de menú deja solo íconos con tooltip y el contenido usa todo el ancho', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  await ingresar(page);
  await page.goto('/mantenedores/moviles');
  const lateral = page.locator('aside.lateral');
  const contenido = page.locator('main.contenido');
  const ancho = (l: Locator) => l.evaluate((e) => Math.round(e.getBoundingClientRect().width));
  const pantalla = await page.evaluate(() => document.documentElement.clientWidth);
  const anchoMenu = await ancho(lateral);
  expect(await ancho(contenido)).toBe(pantalla - anchoMenu);

  await page.getByRole('button', { name: 'Contraer menú' }).click();
  await expect.poll(() => ancho(lateral)).toBeLessThan(80);
  await expect.poll(async () => (await ancho(contenido)) + (await ancho(lateral))).toBe(pantalla);
  await lateral.locator('a[href="/mantenedores/conductores"]').hover();
  await expect(page.locator('.p-tooltip')).toHaveText('Conductores');

  await page.reload();
  await expect.poll(() => ancho(lateral)).toBeLessThan(80);
  await page.getByRole('button', { name: 'Expandir menú' }).click();
  await expect.poll(() => ancho(lateral)).toBe(anchoMenu);
});

test('los grupos del menú se pliegan, se recuerdan y se abren solos en su pantalla', async ({ page }) => {
  await ingresar(page);
  const menu = page.locator('aside.lateral');
  // Administración parte plegada: sus opciones no ocupan espacio.
  await expect(menu.getByRole('link', { name: 'Usuarios' })).toHaveCount(0);
  await menu.getByRole('button', { name: 'Administración' }).click();
  await expect(menu.getByRole('link', { name: 'Usuarios' })).toBeVisible();
  await menu.getByRole('button', { name: 'Operación' }).click();
  await expect(menu.getByRole('link', { name: 'Órdenes de retiro' })).toHaveCount(0);
  await page.reload();
  await expect(menu.getByRole('link', { name: 'Usuarios' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Órdenes de retiro' })).toHaveCount(0);
  // El grupo de la pantalla actual se ve aunque esté plegado.
  await page.goto('/operacion/ordenes-retiro');
  await expect(menu.getByRole('link', { name: 'Órdenes de retiro' })).toBeVisible();
  // Todos a la vez.
  await menu.getByRole('button', { name: 'Abrir todo' }).click();
  await expect(menu.locator('a[href="/mantenedores/conductores"]')).toBeVisible();
  await menu.getByRole('button', { name: 'Cerrar todo' }).click();
  await expect(menu.locator('a[href="/mantenedores/conductores"]')).toHaveCount(0);
  await expect(menu.getByRole('link', { name: 'Usuarios' })).toHaveCount(0);
  await expect(menu.getByRole('link', { name: 'Órdenes de retiro' })).toBeVisible();
});

test('el RUT se formatea al escribir y las fechas tienen calendario y botón Hoy', async ({ page }) => {
  await ingresar(page);
  await page.goto('/mantenedores/conductores');
  await page.getByRole('button', { name: 'Nuevo conductor' }).click();
  // El diálogo enfoca su primer campo al terminar de abrirse; se espera para no competir con él.
  await expect(page.locator('#c-nombre')).toBeFocused();

  const rut = page.locator('#c-rut');
  await rut.pressSequentially('778620707');
  await expect(rut).toHaveValue('77.862.070-7');
  await rut.press('Backspace');
  await expect(rut).toHaveValue('7.786.207-0');
  // Borrar el guion borra el dígito anterior en vez de dejar el cursor trabado.
  await rut.evaluate((el: HTMLInputElement) => el.setSelectionRange(10, 10));
  await rut.press('Backspace');
  await expect(rut).toHaveValue('778.620-0');

  const vencimiento = page.locator('#c-vencLicencia');
  await vencimiento.pressSequentially('31122027');
  await expect(vencimiento).toHaveValue('31/12/2027');

  const ingreso = page.locator('nt-fecha').filter({ has: page.locator('#c-fechaIngreso') });
  await ingreso.getByRole('button', { name: 'Hoy' }).click();
  await expect(page.locator('#c-fechaIngreso')).toHaveValue(hoy);
  await expect(ingreso.getByRole('button', { name: 'Hoy' })).toHaveCount(0);

  await page.locator('#c-terminoContrato').click();
  // El calendario anterior puede seguir cerrándose: se toma el último abierto.
  const calendario = page.locator('.p-datepicker-panel').last();
  await expect(calendario).toBeVisible();
  await calendario.getByRole('button', { name: 'Hoy' }).click();
  await expect(page.locator('#c-terminoContrato')).toHaveValue(hoy);
});

test('la hora se escribe en 24 horas o se elige entre todas las horas y minutos', async ({ page }) => {
  await ingresar(page);
  await page.goto('/operacion/ordenes-retiro/nuevo');
  const hora = page.locator('#c-horaCarga');
  await hora.pressSequentially('930');
  await expect(hora).toHaveValue('9:30');
  await hora.press('Tab');
  await expect(hora).toHaveValue('09:30');

  await hora.click();
  const panel = page.locator('.p-popover').last();
  await expect(panel).toBeVisible();
  const listas = panel.locator('.lista');
  await expect(listas.first().getByRole('button')).toHaveCount(24);
  await expect(listas.last().getByRole('button')).toHaveCount(60);
  await listas.first().getByRole('button', { name: '23', exact: true }).click();
  await expect(hora).toHaveValue('23:30');
  await listas.last().getByRole('button', { name: '59', exact: true }).click();
  await expect(hora).toHaveValue('23:59');
  await expect(panel).toBeHidden();

  // Una hora imposible no se acepta: vuelve la anterior.
  await hora.fill('25:00');
  await hora.press('Tab');
  await expect(hora).toHaveValue('23:59');
});
