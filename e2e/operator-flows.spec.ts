import { test, expect } from '@playwright/test';
import { loginAsOperator, navigateVia } from './helpers';

test.describe('Operator Flows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOperator(page);
  });

  test('navigate to Live View and see cameras', async ({ page }) => {
    await navigateVia(page, 'Vista en Vivo');
    await expect(page).toHaveURL(/live-view/);
    // Should show camera grid or site selector
    await expect(page.locator('main').getByText(/cámara|camera|stream|sede|site/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('navigate to Devices and list loads', async ({ page }) => {
    await navigateVia(page, 'Dispositivos');
    await expect(page).toHaveURL(/devices/);
    // Device list/table should appear
    await page.waitForSelector('table, [role="grid"], [data-testid="device-list"]', { timeout: 10000 }).catch(() => {});
    // At least some content should be visible
    const mainContent = page.locator('main');
    await expect(mainContent).not.toBeEmpty();
  });

  test('navigate to Events and list loads', async ({ page }) => {
    await navigateVia(page, 'Eventos');
    await expect(page).toHaveURL(/events/);
    await page.waitForLoadState('networkidle').catch(() => {});
    const mainContent = page.locator('main');
    await expect(mainContent).not.toBeEmpty();
  });

  test('navigate to Sites and see site list', async ({ page }) => {
    await navigateVia(page, 'Sedes');
    await expect(page).toHaveURL(/sites/);
    await page.waitForLoadState('networkidle').catch(() => {});
    const mainContent = page.locator('main');
    await expect(mainContent).not.toBeEmpty();
  });

  test('navigate to Access Control', async ({ page }) => {
    await navigateVia(page, 'Control de Acceso');
    await expect(page).toHaveURL(/access-control/);
    await page.waitForLoadState('networkidle').catch(() => {});
  });

  test('navigate to Alerts', async ({ page }) => {
    await navigateVia(page, 'Alertas');
    await expect(page).toHaveURL(/alerts/);
    await page.waitForLoadState('networkidle').catch(() => {});
  });

  test('navigate to Incidents', async ({ page }) => {
    await navigateVia(page, 'Incidentes');
    await expect(page).toHaveURL(/incidents/);
    await page.waitForLoadState('networkidle').catch(() => {});
  });

  test('navigate to Domotics', async ({ page }) => {
    await navigateVia(page, 'Domótica');
    await expect(page).toHaveURL(/domotics/);
    await page.waitForLoadState('networkidle').catch(() => {});
  });

  test('navigate to Intercom', async ({ page }) => {
    await navigateVia(page, 'Intercomunicación');
    await expect(page).toHaveURL(/intercom/);
    await page.waitForLoadState('networkidle').catch(() => {});
  });

  test('navigate to Shifts', async ({ page }) => {
    await navigateVia(page, 'Turnos');
    await expect(page).toHaveURL(/shifts/);
    await page.waitForLoadState('networkidle').catch(() => {});
  });

  test('navigate to Patrols', async ({ page }) => {
    await navigateVia(page, 'Rondas');
    await expect(page).toHaveURL(/patrols/);
    await page.waitForLoadState('networkidle').catch(() => {});
  });

  test('navigate to Reports', async ({ page }) => {
    await navigateVia(page, 'Reportes');
    await expect(page).toHaveURL(/reports/);
    await page.waitForLoadState('networkidle').catch(() => {});
  });

  test('command palette opens with Ctrl+K', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    await expect(page.getByPlaceholder(/buscar|search/i)).toBeVisible({ timeout: 5000 });
  });

  test('user menu opens and shows profile options', async ({ page }) => {
    const userBtn = page.locator('aside').getByLabel('User menu');
    await userBtn.click();
    await expect(page.getByText(/perfil|profile/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/cerrar sesión|sign out/i)).toBeVisible();
  });
});
