import { expect, test } from '@playwright/test';

test('资料到知识点、来源、笔记、进度和学习地图形成同一条持久化闭环', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('./#/course/laser/resources');
  await page.getByRole('button', { name: '添加资料', exact: true }).click();
  await page.getByLabel('课程资料文件').setInputFiles('tests/fixtures/chinese-course.pptx');
  await page.getByRole('button', { name: '上传并解析', exact: true }).click();
  await page.getByRole('button', { name: '查看解析结果', exact: true }).click();

  const point = page.locator('.material-point').first();
  const title = (await point.locator('strong').innerText()).trim();
  await point.getByRole('button', { name: '开始学习', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.locator('.study-source')).toContainText('对应资料原文');

  await page.getByLabel('我的笔记', { exact: true }).fill('晶体结合要从相互作用和能量最低理解。');
  await page.getByRole('button', { name: '开始学习', exact: true }).click();
  await expect(page.getByLabel('掌握程度')).toHaveValue('learning');
  await page
    .locator('.study-status')
    .getByRole('button', { name: '查看来源', exact: true })
    .click();
  await expect(page.locator('.reader-text')).toContainText('晶体');
  await expect(page.locator('.reader-knowledge')).toContainText(title);

  await page.locator('.reader-knowledge').getByRole('button', { name: '开始学习' }).first().click();
  await page.getByRole('button', { name: '标记已掌握', exact: true }).click();
  await expect(page.getByLabel('掌握程度')).toHaveValue('mastered');
  await expect(page.locator('.course-progress')).toContainText('1 / 6 个已掌握');

  await page.getByRole('button', { name: '学习地图', exact: true }).click();
  await expect(page.locator('.map-node').filter({ hasText: title })).toContainText('已掌握');
  await page.locator('.map-node').filter({ hasText: title }).click();
  await page.reload();
  await expect(page.getByLabel('我的笔记', { exact: true })).toHaveValue(
    '晶体结合要从相互作用和能量最低理解。',
  );
  await expect(page.getByLabel('掌握程度')).toHaveValue('mastered');
  await expect(page.locator('.course-progress')).toContainText('1 / 6 个已掌握');
  expect(errors).toEqual([]);
});
