import { expect, test, type Page } from '@playwright/test';
import { ingresar } from './ayudas';

/** La versión compilada de la web; en las pruebas se fija antes de que cargue la página. */
const compilarVersion = (page: Page, version: string) =>
  page.addInitScript((v) => {
    (window as unknown as { NT_VERSION: string }).NT_VERSION = v;
  }, version);

test('una versión nueva exige actualizar y da plazo a quien tiene cambios sin guardar', async ({ page }) => {
  let publicada = 'v1';
  await compilarVersion(page, 'v1');
  await page.route('**/version.json*', (r) => r.fulfill({ json: { version: publicada } }));
  const aviso = page.getByRole('dialog', { name: 'Hay una versión nueva' });
  const volverALaPestana = () => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

  await ingresar(page);
  await page.goto('/mantenedores/moviles');
  await page.getByRole('button', { name: 'Nuevo móvil' }).click();
  const patente = page.locator('#c-patente');
  await expect(patente).toBeFocused();
  await patente.fill('ZZ1234');

  // Se publica otra versión mientras hay un formulario a medio llenar.
  publicada = 'v2';
  await volverALaPestana();
  await expect(aviso).toContainText('cambios sin guardar');
  await page.keyboard.press('Escape');
  await expect(aviso).toBeVisible();
  await expect(patente).toHaveValue('ZZ1234');

  // Puede volver a guardar; una franja recuerda que debe actualizar.
  await aviso.getByRole('button', { name: 'Guardar primero' }).click();
  await expect(aviso).toBeHidden();
  await expect(page.getByRole('status').filter({ hasText: 'Hay una versión nueva' })).toBeVisible();

  // Sin nada pendiente, el aviso vuelve a bloquear y solo deja actualizar.
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(aviso).toContainText('Para continuar, actualice');
  await expect(aviso.getByRole('button', { name: 'Guardar primero' })).toHaveCount(0);

  // Al actualizar llega la versión nueva y el aviso no vuelve.
  await compilarVersion(page, 'v2');
  await aviso.getByRole('button', { name: 'Actualizar ahora' }).click();
  await expect(page.getByRole('heading', { name: 'Móviles' })).toBeVisible();
  await volverALaPestana();
  await page.waitForTimeout(500);
  await expect(aviso).toBeHidden();
});
