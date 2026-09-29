import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
async function choose(page: Page, name: string) {
  await page.goto('./#/course/laser');
  await page.getByRole('button', { name: '课程资料', exact: true }).click();
  await page.getByRole('button', { name: '添加资料', exact: true }).click();
  await page.getByLabel('课程资料文件').setInputFiles('tests/fixtures/' + name);
  await page.getByRole('button', { name: '上传并解析', exact: true }).click();
}
for (const extension of ['pdf', 'pptx', 'docx', 'md']) {
  test('真实中文文件解析：' + extension, async ({ page }) => {
    const errors: string[] = [];
    const debug: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.text().includes('[DocumentParser]')) debug.push(m.text());
    });
    await choose(page, 'chinese-course.' + extension);
    await page.getByRole('button', { name: '查看解析结果' }).click();
    await expect(page.locator('.material-summary')).toContainText('晶体');
    await expect(page.locator('.imported-text')).toContainText('晶体');
    await page.getByRole('button', { name: '下一页 / 片段' }).click();
    await expect(page.locator('.imported-text')).toContainText('晶格振动');
    const result = await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('learnflow:v1:/learnflow/')!);
      const r = d.resources[0];
      return {
        extraction: r.extraction,
        summary: r.analysis.summary,
        points: d.nodes.filter((n: { source?: { fileId: string } }) => n.source?.fileId === r.id),
      };
    });
    expect(result.extraction.metadata.parserVersion).toBe(2);
    expect(result.extraction.metadata.pageCount).toBe(2);
    expect(result.extraction.metadata.characters).toBeGreaterThan(20);
    expect(result.extraction.metadata.needsOCR).toBe(false);
    expect(result.extraction.fullText).not.toMatch(/PK[\u0000-\u0008]|[\u0000-\u0008\ufffd]|■{4}/);
    expect(result.summary).not.toMatch(/PK|\ufffd|■/);
    expect(result.extraction.fullText).toContain(
      extension === 'pdf'
        ? '--- Page 2 ---'
        : extension === 'pptx'
          ? '--- Slide 2 ---'
          : '--- Section 2 ---',
    );
    for (const point of result.points) {
      expect(result.extraction.fullText).toContain(point.summary);
      expect(point.source.page).toBe(
        extension === 'pdf' || extension === 'pptx' ? result.points.indexOf(point) + 1 : null,
      );
    }
    expect(errors).toEqual([]);
    expect(debug).toEqual([]); // Production never logs private document previews.
    await page.getByRole('button', { name: '开始学习', exact: true }).first().click();
    await page.getByRole('button', { name: '笔记', exact: true }).click();
    await page.getByLabel('学习笔记', { exact: true }).fill('重解析必须保留我的笔记');
    await page.getByRole('button', { name: '我懂了', exact: true }).click();
    await page.getByRole('button', { name: '课程资料', exact: true }).click();
    await page.getByRole('button', { name: '重新解析', exact: true }).click();
    await page.getByRole('button', { name: '查看解析结果' }).click();
    const after = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('learnflow:v1:/learnflow/')!),
    );
    expect(after.nodes.filter((n: { source?: unknown }) => n.source)).toHaveLength(2);
    expect(
      after.nodes.find((n: { id: string }) => n.id === result.points[0].id).content.notes,
    ).toBe('重解析必须保留我的笔记');
    expect(after.nodes.find((n: { id: string }) => n.id === result.points[0].id).status).toBe(
      'understood',
    );
  });
}
test('扫描 PDF 记录 needsOCR，不调用 Mock，不生成假知识点', async ({ page }) => {
  await choose(page, 'scanned-course.pdf');
  await expect(page.getByText('资料已保存，等待 OCR')).toBeVisible();
  await page.getByRole('button', { name: '查看解析结果' }).click();
  await expect(page.getByText(/该 PDF 可能为扫描版，需要 OCR/)).toBeVisible();
  await expect(page.locator('.material-point')).toHaveCount(0);
  const d = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('learnflow:v1:/learnflow/')!),
  );
  expect(d.resources[0].analysis).toBeUndefined();
  expect(d.resources[0].extraction.metadata.needsOCR).toBe(true);
  expect(d.resources[0].extraction.metadata.ocrPages).toEqual([1]);
  expect(d.nodes.filter((n: { source?: unknown }) => n.source)).toHaveLength(0);
});
test('ZIP 伪装 TXT 和损坏 Office 被阻止，不保存乱码摘要', async ({ page }) => {
  for (const [name, buffer] of [
    ['wrong.txt', readFileSync('tests/fixtures/chinese-course.pptx')],
    ['broken.docx', Buffer.from([80, 75, 3, 4, 0, 1, 2, 3])],
    ['bad-encoding.txt', Buffer.from([0xff, 0xfe, 0, 2, 0xff])],
  ] as const) {
    await page.goto('./#/course/laser');
    await page.getByRole('button', { name: '课程资料', exact: true }).click();
    await page.getByRole('button', { name: '添加资料', exact: true }).click();
    await page
      .getByLabel('课程资料文件')
      .setInputFiles({ name, buffer, mimeType: 'application/octet-stream' });
    await page.getByRole('button', { name: '上传并解析' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('文件解析失败');
    await page.getByRole('button', { name: '关闭', exact: true }).click();
  }
  const d = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('learnflow:v1:/learnflow/')!),
  );
  expect(d.resources.every((r: { analysis?: unknown }) => !r.analysis)).toBe(true);
  expect(d.nodes.filter((n: { source?: unknown }) => n.source)).toHaveLength(0);
});

test('旧乱码摘要不会继续展示，重新解析原件后恢复干净正文', async ({ page }) => {
  await choose(page, 'chinese-course.pptx');
  await page.getByRole('button', { name: '查看解析结果' }).click();
  await page.evaluate(() => {
    const key = 'learnflow:v1:/learnflow/';
    const d = JSON.parse(localStorage.getItem(key)!);
    const r = d.resources[0];
    delete r.extraction.metadata;
    delete r.analysis.parserVersion;
    r.analysis.summary = 'PK\u0003\u0004\ufffd旧乱码';
    for (const n of d.nodes)
      if (n.source?.fileId === r.id) {
        n.summary = n.content.concept = 'PK\u0003\u0004\ufffd旧乱码';
        n.content.notes = '保留旧笔记';
      }
    localStorage.setItem(key, JSON.stringify(d));
  });
  await page.reload();
  await page.getByRole('button', { name: '课程资料', exact: true }).click();
  await page.getByRole('button', { name: '查看资料 →' }).click();
  await expect(page.getByText(/此资料使用旧解析结果/)).toBeVisible();
  await expect(page.locator('.material-summary')).toHaveCount(0);
  await page.getByRole('button', { name: '← 返回课程资料' }).click();
  await page.getByRole('button', { name: '重新解析', exact: true }).click();
  await page.getByRole('button', { name: '查看解析结果' }).click();
  await expect(page.locator('.material-summary')).toContainText('晶体');
  await expect(page.locator('.material-summary')).not.toContainText('PK');
  const d = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('learnflow:v1:/learnflow/')!),
  );
  expect(d.nodes.filter((n: { source?: unknown }) => n.source)).toHaveLength(2);
  expect(
    d.nodes
      .filter((n: { source?: unknown }) => n.source)
      .every(
        (n: { content: { notes: string; concept: string } }) =>
          n.content.notes === '保留旧笔记' && !n.content.concept.includes('PK'),
      ),
  ).toBe(true);
});
test('旧版 PPT/DOC 停止解析并提示转换，不生成 Mock 占位', async ({ page }) => {
  for (const extension of ['ppt', 'doc']) {
    await page.goto('./#/course/laser');
    await page.getByRole('button', { name: '课程资料', exact: true }).click();
    await page.getByRole('button', { name: '添加资料', exact: true }).click();
    await page.getByLabel('课程资料文件').setInputFiles({
      name: 'legacy.' + extension,
      mimeType: 'application/octet-stream',
      buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    });
    await page.getByRole('button', { name: '上传并解析' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('另存为 PPTX / DOCX');
    await page.getByRole('button', { name: '关闭', exact: true }).click();
  }
  const d = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('learnflow:v1:/learnflow/')!),
  );
  expect(d.resources.every((r: { analysis?: unknown }) => !r.analysis)).toBe(true);
});
