import { test, expect, type Page } from '@playwright/test';
import { zipSync, strToU8 } from 'fflate';
async function openUpload(page: Page) {
  await page.goto('./#/course/laser');
  await page.getByRole('button', { name: '课程资料', exact: true }).click();
  await page.getByRole('button', { name: '添加资料', exact: true }).click();
}
async function upload(
  page: Page,
  name: string,
  buffer: Buffer,
  mimeType = 'application/octet-stream',
) {
  await openUpload(page);
  await page.getByLabel('课程资料文件').setInputFiles({ name, mimeType, buffer });
  await expect(page.getByLabel('资料名称')).toHaveValue(name);
  await page.getByRole('button', { name: '上传并解析', exact: true }).click();
  await expect(page.getByText('资料已整理，可以开始学习')).toBeVisible();
  await page.getByRole('button', { name: '查看解析结果' }).click();
}
test('Markdown 上传、原文安全显示、结构化知识和原文件刷新持久化', async ({ page }) => {
  await upload(
    page,
    '课堂.md',
    Buffer.from('# 光束定义\n核心定义与公式\n<script>alert("unsafe")</script>\n# 附录\n历史背景'),
    'text/markdown',
  );
  await expect(page.getByText('Mock 分析草案 · 未调用 AI')).toBeVisible();
  await expect(page.locator('.imported-text')).toContainText('<script>');
  await expect(page.locator('.material-point')).toHaveCount(2);
  await page.getByRole('button', { name: '开始学习', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: '光束定义', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '加入复习', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('掌握程度')).toHaveValue('review');
  await page.getByRole('button', { name: '课程资料', exact: true }).click();
  await page.getByRole('button', { name: '查看资料 →' }).click();
  await expect(page.getByRole('link', { name: '下载原文件' })).toBeVisible();
  const waiting = page.waitForEvent('download');
  await page.getByRole('link', { name: '下载原文件' }).click();
  expect((await waiting).suggestedFilename()).toBe('课堂.md');
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('learnflow:v1:/learnflow/')!),
  );
  expect(data.resources[0].analysis.knowledgePointIds).toHaveLength(2);
  const point = data.nodes.find(
    (n: { source?: { fileId: string } }) => n.source?.fileId === data.resources[0].id,
  );
  expect(point.source.page).toBeNull();
  expect(point.status).toBe('review');
});
test('拖拽、文件校验、删除和重新选择、在线资料兼容', async ({ page }) => {
  await openUpload(page);
  await page
    .getByLabel('课程资料文件')
    .setInputFiles({ name: 'bad.exe', mimeType: 'text/plain', buffer: Buffer.from('bad') });
  await expect(page.getByRole('alert')).toContainText('不支持');
  await page.locator('.file-drop').evaluate((el) => {
    const dt = new DataTransfer();
    dt.items.add(new File(['核心定义：测试正文'], '笔记.txt', { type: 'text/plain' }));
    el.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
  });
  await expect(page.locator('.selected-file')).toContainText('TXT');
  await page.getByRole('button', { name: '删除', exact: true }).click();
  await expect(page.getByRole('button', { name: '上传并解析' })).toBeDisabled();
  await page
    .getByLabel('课程资料文件')
    .setInputFiles({ name: '笔记.txt', mimeType: 'text/plain', buffer: Buffer.from('定义：函数') });
  await page.getByLabel('资料名称').fill('我的笔记');
  await page.getByRole('button', { name: '上传并解析' }).click();
  await page.getByRole('button', { name: '查看解析结果' }).click();
  await expect(page.getByRole('heading', { name: '我的笔记', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '← 返回课程资料' }).click();
  await page.getByRole('button', { name: '添加在线资料 ↗' }).click();
  await page.getByLabel('名称', { exact: true }).fill('教材');
  await page.getByLabel('链接（可选）').fill('https://example.com/book');
  await page.getByRole('button', { name: '保存资料' }).click();
  await expect(page.getByRole('link', { name: '打开资料 ↗' })).toHaveAttribute(
    'href',
    'https://example.com/book',
  );
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '删除资料我的笔记' }).click();
  await expect(page.locator('.resource-list')).not.toContainText('我的笔记');
});
const xml = (text: string) => strToU8(text);
test('PPTX 按真实幻灯片顺序提取并保存页码', async ({ page }) => {
  const slides = (s: string) =>
    xml(
      '<p:sld xmlns:p="urn:p" xmlns:a="urn:a"><a:p><a:r><a:t>' + s + '</a:t></a:r></a:p></p:sld>',
    );
  const zip = zipSync({
    'ppt/presentation.xml': xml(
      '<p:presentation xmlns:p="urn:p" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId r:id="r2"/><p:sldId r:id="r1"/></p:sldIdLst></p:presentation>',
    ),
    'ppt/_rels/presentation.xml.rels': xml(
      '<Relationships><Relationship Id="r1" Target="slides/slide1.xml"/><Relationship Id="r2" Target="slides/slide2.xml"/></Relationships>',
    ),
    'ppt/slides/slide1.xml': slides('第二页定义'),
    'ppt/slides/slide2.xml': slides('第一页公式'),
  });
  await upload(page, '课程.pptx', Buffer.from(zip));
  await expect(page.locator('.imported-text')).toHaveText('第一页公式');
  await page.getByRole('button', { name: '下一页 / 片段' }).click();
  await expect(page.locator('.imported-text')).toHaveText('第二页定义');
  await expect(page.locator('.material-point').first()).toContainText('第 1 页');
});
test('DOCX 提取正文，保留无固定页码来源', async ({ page }) => {
  const zip = zipSync({
    'word/document.xml': xml(
      '<w:document xmlns:w="urn:w"><w:body><w:p><w:r><w:t>热力学基本定义</w:t></w:r></w:p></w:body></w:document>',
    ),
  });
  await upload(page, '教材.docx', Buffer.from(zip));
  await expect(page.locator('.imported-text')).toContainText('热力学基本定义');
  await expect(page.locator('.material-point')).toContainText('无固定页码');
});
function pdf() {
  const stream = 'BT /F1 20 Tf 50 700 Td (Gaussian beam definition) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(out.length);
    out += i + 1 + ' 0 obj\n' + obj + '\nendobj\n';
  });
  const start = out.length;
  out += 'xref\n0 6\n0000000000 65535 f \n';
  out += offsets
    .slice(1)
    .map((o) => String(o).padStart(10, '0') + ' 00000 n \n')
    .join('');
  out += 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + start + '\n%%EOF';
  return Buffer.from(out);
}
test('GitHub Pages 子路径下 PDF worker 可用且真实提取文字', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await upload(page, 'laser.pdf', pdf(), 'application/pdf');
  await expect(page.locator('.imported-text')).toContainText('Gaussian beam definition');
  await expect(page.locator('.material-point')).toContainText('第 1 页');
  expect(errors).toEqual([]);
});
test('图片和旧版 Office 不虚构正文，损坏 PDF 可重试', async ({ page }) => {
  await upload(
    page,
    '课堂.png',
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1sAAAAASUVORK5CYII=',
      'base64',
    ),
    'image/png',
  );
  await expect(page.locator('.material-image')).toBeVisible();
  await expect(page.locator('.material-point')).toContainText('待识别内容（Mock 示例）');
  await page.getByRole('button', { name: '← 返回课程资料' }).click();
  await page.getByRole('button', { name: '添加资料', exact: true }).click();
  await page.getByLabel('课程资料文件').setInputFiles({
    name: 'broken.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('invalid'),
  });
  await page.getByRole('button', { name: '上传并解析' }).click();
  await expect(page.getByRole('alert')).toContainText('PDF 无法读取');
  await page.getByRole('button', { name: '关闭', exact: true }).first().click();
  await expect(page.getByRole('button', { name: '重新解析' })).toBeVisible();
  await page.getByRole('button', { name: '重新解析' }).click();
  await expect(page.getByRole('alert')).toContainText('PDF 无法读取');
});

test('取消解析可恢复，存储失败不生成假成功', async ({ page }) => {
  await openUpload(page);
  await page.evaluate(() => {
    const read = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return read.call(this);
    };
  });
  await page.getByLabel('课程资料文件').setInputFiles({
    name: 'cancel.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('定义：取消与重试'),
  });
  await page.getByRole('button', { name: '上传并解析' }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('learnflow:v1:/learnflow/')!).resources.length,
      ),
    )
    .toBe(1);
  await page.getByRole('button', { name: '取消解析' }).click();
  await expect(page.getByRole('button', { name: '重新解析' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '课程资料', exact: true }).click();
  await page.getByRole('button', { name: '重新解析' }).click();
  await page.getByRole('button', { name: '查看解析结果' }).click();
  await expect(page.locator('.material-point')).toHaveCount(1);
  await page.getByRole('button', { name: '← 返回课程资料' }).click();
  await page.getByRole('button', { name: '添加资料', exact: true }).click();
  await page.getByLabel('课程资料文件').setInputFiles({
    name: 'quota.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('不会被保存'),
  });
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
  });
  await page.getByRole('button', { name: '上传并解析' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('保存失败');
  await expect(page.getByText('资料已整理，可以开始学习')).toHaveCount(0);
});
test('旧格式明确占位，移动端资料布局与浅深色截图', async ({ page }) => {
  await upload(page, 'lecture.ppt', Buffer.from('legacy format'));
  await expect(page.locator('.material-point')).toContainText('待识别内容');
  await page.getByText('解析范围与校对提示').click();
  await expect(page.getByText(/旧版二进制 Office 格式暂未解码/)).toBeVisible();
  await page.screenshot({ path: 'test-results/material-detail-desktop.png', fullPage: true });
  await page.locator('.resources-page').evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.getByRole('button', { name: '切换深色模式', exact: true }).click();
  await page.screenshot({ path: 'test-results/material-detail-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '← 返回课程资料' }).click();
  await page.getByRole('button', { name: '添加资料', exact: true }).click();
  await page.screenshot({ path: 'test-results/material-upload-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
