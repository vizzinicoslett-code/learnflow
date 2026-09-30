import { expect, test } from '@playwright/test';
import { brokenFontPdf } from './fixtures/broken-font-pdf';

test('真实 PDF 错误字体映射不能生成摘要和知识点', async ({ page }) => {
  await page.goto('./#/course/laser/resources');
  await page.getByRole('button', { name: '添加资料', exact: true }).click();
  await page.getByLabel('课程资料文件').setInputFiles({
    name: '错误字体映射.pdf',
    mimeType: 'application/pdf',
    buffer: brokenFontPdf(),
  });
  await page.getByRole('button', { name: '上传并解析', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('无法识别的字形');
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('learnflow:v1:/learnflow/')!),
  );
  expect(saved.resources[0].processing.status).toBe('error');
  expect(saved.resources[0].analysis).toBeUndefined();
  expect(saved.nodes.filter((node: { source?: unknown }) => node.source)).toHaveLength(0);
});

test('旧乱码结果停止推荐，原件与笔记保留，重新解析恢复同一个知识点', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./#/course/laser/resources');
  await page.getByRole('button', { name: '添加资料', exact: true }).click();
  await page.getByLabel('课程资料文件').setInputFiles('tests/fixtures/chinese-course.pdf');
  await page.getByRole('button', { name: '上传并解析', exact: true }).click();
  await page.getByRole('button', { name: '查看解析结果' }).click();
  const ids = await page.evaluate(() => {
    const key = 'learnflow:v1:/learnflow/';
    const data = JSON.parse(localStorage.getItem(key)!);
    const resource = data.resources[0];
    const node = data.nodes.find(
      (item: { id: string }) => item.id === resource.analysis.knowledgePointIds[0],
    );
    const broken = 'љЗΨљ☰љ屡◌ ☰☰☰☰9 SOZN 41 Ĥ☰ = ☰ 6◌☰☰ + ☰ VSWR = ☰☰☰☰ tan ψ'.repeat(
      8,
    );
    resource.extraction.pages[0].text = broken;
    resource.extraction.fullText = broken;
    resource.extraction.metadata.characters = broken.length;
    resource.analysis.summary = broken;
    node.summary = broken;
    node.content.concept = broken;
    node.content.notes = '这条笔记必须保留';
    node.status = 'mastered';
    localStorage.setItem(key, JSON.stringify(data));
    return { document: resource.id, node: node.id };
  });
  await page.goto('./#/course/laser');
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('提取文字无法可靠识别');
  await expect(page.locator('.course-progress')).toContainText('0 / 5');
  await expect(page.locator('body')).not.toContainText('SOZN');
  await page.screenshot({ path: 'test-results/quarantined-material.png', fullPage: true });
  await page.getByRole('button', { name: '学习地图', exact: true }).click();
  await expect(page.locator('.map-node')).toHaveCount(5);
  await page.getByRole('button', { name: '知识工作台', exact: true }).click();
  await page.locator('.tree-node').filter({ hasText: '待处理' }).click();
  await expect(
    page.getByRole('heading', { name: '这个知识点的来源文字无法可靠识别' }),
  ).toBeVisible();
  await expect(page.getByLabel('我的笔记')).toHaveValue('这条笔记必须保留');
  await page.getByRole('button', { name: '查看原始资料', exact: true }).click();
  await expect(page.locator('.material-summary')).toHaveCount(0);
  await page.getByRole('button', { name: '查看原始 PDF', exact: true }).click();
  await expect(page.getByTitle('原始 PDF')).toHaveAttribute('src', /^blob:/);
  await page.getByRole('button', { name: '返回课程资料' }).click();
  await page.getByRole('button', { name: '重新解析', exact: true }).click();
  await page.getByRole('button', { name: '查看解析结果' }).click();
  await page.goto(`./#/course/laser/${ids.node}`);
  await expect(page.getByLabel('我的笔记')).toHaveValue('这条笔记必须保留');
  await expect(page.getByLabel('掌握程度')).toHaveValue('mastered');
  await expect(page.locator('.course-progress')).toContainText('1 / 6');
  await expect(page.locator('.study-summary')).toContainText('晶体');
  expect(errors).toEqual([]);
});
