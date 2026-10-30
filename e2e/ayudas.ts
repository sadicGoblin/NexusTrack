import { expect, type Locator, type Page } from '@playwright/test';

/** Elige una opción en un p-select identificado por su inputId (filtra si la lista lo permite). */
export async function elegir(page: Page, id: string, opcion: string): Promise<void> {
  await page.locator(`#${id}`).click();
  const panel = page.locator('.p-select-overlay').last();
  await expect(panel).toBeVisible();
  const filtro = panel.locator('input[role="searchbox"], input.p-select-filter');
  if (await filtro.count()) await filtro.first().fill(opcion);
  await panel.getByRole('option').filter({ hasText: opcion }).first().click();
  await expect(panel).toBeHidden();
}

/** Escribe en un p-inputnumber tecla por tecla (como un usuario). */
export async function escribirNumero(campo: Locator, valor: string): Promise<void> {
  await campo.click();
  await campo.press('ControlOrMeta+a');
  await campo.press('Backspace');
  await campo.pressSequentially(valor);
  await campo.press('Tab');
}

export async function ingresar(
  page: Page,
  email = 'admin@nexustrack.cl',
  password = 'Admin123!',
): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/inicio/);
}
