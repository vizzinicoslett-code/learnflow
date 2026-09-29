import { test, expect } from '@playwright/test';
test('课程与知识结构 CRUD、排序和刷新持久化', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '新建课程', exact: true }).click();
  await page.getByLabel('课程名称').fill('线性代数');
  await page.getByLabel('一句话介绍').fill('理解空间与变换');
  await page.getByRole('button', { name: '创建课程', exact: true }).click();
  await page.getByRole('button', { name: /线性代数 理解空间与变换/ }).click();
  await page.getByRole('button', { name: '添加章节 / 知识点', exact: true }).click();
  await page.getByLabel('名称', { exact: true }).fill('矩阵');
  await page.getByLabel('类型', { exact: true }).selectOption('chapter');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  for (const title of ['矩阵乘法', '矩阵求逆']) {
    await page.getByRole('button', { name: '添加章节 / 知识点', exact: true }).click();
    await page.getByLabel('名称', { exact: true }).fill(title);
    await page.getByLabel('父节点').selectOption({ label: '章节 · 矩阵' });
    await page.getByRole('button', { name: '保存', exact: true }).click();
  }
  await page.getByRole('button', { name: '上移矩阵求逆', exact: true }).click();
  await expect(page.locator('.tree-row.topic .tree-node').first()).toHaveText('矩阵求逆');
  await page.getByRole('button', { name: '编辑当前知识结构' }).click();
  await page.getByLabel('名称', { exact: true }).fill('逆矩阵');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByLabel('核心概念', { exact: true }).fill('AB = BA = I');
  await page.getByLabel('重要程度').selectOption('3');
  await page.getByRole('button', { name: '我懂了', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: '逆矩阵', exact: true })).toBeVisible();
  await expect(page.getByLabel('核心概念', { exact: true })).toHaveValue('AB = BA = I');
  await expect(page.getByLabel('掌握程度')).toHaveValue('understood');
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '删除当前知识结构' }).click();
  await expect(page.locator('.tree-node').filter({ hasText: '逆矩阵' })).toHaveCount(0);
  await page.getByRole('button', { name: '我的课程', exact: true }).click();
  await page.getByRole('button', { name: '编辑线性代数', exact: true }).click();
  await page.getByLabel('课程名称').fill('高等代数');
  await page.getByRole('button', { name: '保存修改' }).click();
  await page.getByRole('button', { name: '删除高等代数', exact: true }).click();
  await expect(page.getByRole('button', { name: '编辑高等代数' })).toHaveCount(0);
});
test('学习闭环、自测、笔记、复习和统计', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./#/course/laser/laser-0');
  await page.getByRole('button', { name: '完全不会', exact: true }).click();
  await page.getByRole('button', { name: '完全不会', exact: true }).click();
  await page.getByRole('button', { name: '加入复习', exact: true }).click();
  await page.getByRole('link', { name: /复习计划/ }).click();
  await expect(page.locator('.node-row').filter({ hasText: 'ABCD 矩阵' })).toBeVisible();
  await page.locator('.node-row').filter({ hasText: 'ABCD 矩阵' }).click();
  await page.locator('.learning-actions').getByRole('button', { name: '考我一道' }).click();
  await expect(page.locator('.quiz h4')).toContainText('薄透镜');
  await page.getByLabel('我的作答').fill('M = M透镜 × M传播');
  await page.getByRole('button', { name: '查看参考答案' }).click();
  await expect(page.locator('.reference')).toContainText('1−L/f');
  await page.getByRole('button', { name: '答对了', exact: true }).click();
  await expect(page.getByLabel('掌握程度')).toHaveValue('mastered');
  await page.getByRole('button', { name: '学习地图', exact: true }).click();
  await page.getByRole('button', { name: '知识工作台', exact: true }).click();
  await expect(page.locator('.quiz')).toHaveCount(0);
  await page.getByRole('button', { name: '笔记', exact: true }).click();
  await page.getByLabel('学习笔记', { exact: true }).fill('先传播，再折射，右侧先算。');
  await page.reload();
  await page.getByRole('button', { name: '笔记', exact: true }).click();
  await expect(page.getByLabel('学习笔记', { exact: true })).toHaveValue(
    '先传播，再折射，右侧先算。',
  );
  await page.getByRole('link', { name: '学习统计' }).click();
  await expect(page.locator('.stats-overview')).toContainText('已掌握1');
  await expect(page.locator('.stats-overview')).toContainText('本周学习4');
  expect(errors).toEqual([]);
});
test('地图导航、前置循环拒绝与同级拖动', async ({ page }) => {
  await page.goto('./#/course/laser/laser-0');
  await page.getByLabel('添加前置知识点').selectOption('laser-3');
  await expect(page.getByRole('alert')).toContainText('循环');
  await page.getByLabel('添加相关知识点').selectOption('laser-2');
  await page.getByRole('button', { name: '学习地图', exact: true }).click();
  await expect(page.locator('.map-node')).toHaveCount(4);
  await page.locator('.map-node').filter({ hasText: '复参数 q' }).click();
  await expect(page.getByRole('heading', { name: '复参数 q', exact: true })).toBeVisible();
  await page.locator('.tree-row.topic').first().dragTo(page.locator('.tree-row.topic').last());
  await expect(page.locator('.tree-row.topic .tree-node').last()).toHaveText('ABCD 矩阵');
  await page.reload();
  await expect(page.locator('.tree-row.topic .tree-node').last()).toHaveText('ABCD 矩阵');
});
test('资料链接与 Markdown 安全导入、编辑和删除', async ({ page }) => {
  await page.goto('./#/course/laser');
  await page.getByRole('button', { name: '课程资料', exact: true }).click();
  await page.locator('.resources-page input[type=file]').setInputFiles({
    name: '课堂.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# 光学\n<script>alert("unsafe")</script>\n我的课堂笔记'),
  });
  await page.getByRole('button', { name: '阅读导入文本 →' }).click();
  await expect(page.locator('.imported-text')).toContainText('<script>');
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '添加资料', exact: true }).click();
  await page.getByLabel('名称', { exact: true }).fill('教材');
  await page.getByLabel('链接（可选）').fill('https://example.com/book');
  await page.getByRole('button', { name: '保存资料' }).click();
  await expect(page.getByRole('link', { name: '打开资料 ↗' })).toHaveAttribute(
    'href',
    'https://example.com/book',
  );
  await page.getByRole('button', { name: '编辑资料教材' }).click();
  await page.getByLabel('备注').fill('第 2 章');
  await page.getByRole('button', { name: '保存资料' }).click();
  await page.reload();
  await page.getByRole('button', { name: '课程资料', exact: true }).click();
  await expect(page.locator('.resource-list')).toContainText('第 2 章');
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '删除资料教材' }).click();
  await expect(page.getByRole('link', { name: '打开资料 ↗' })).toHaveCount(0);
});
test('完整备份往返、无效导入不破坏数据、主题保留', async ({ page }) => {
  await page.goto('./#/settings');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整备份' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/learnflow-backup/);
  await page.locator('.settings-section input[type=file]').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"schemaVersion":2}'),
  });
  await expect(page.getByRole('status')).toContainText('数据格式');
  const snapshot = await page.evaluate(() => localStorage.getItem('learnflow:v1:/learnflow/'));
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '清空数据', exact: true }).click();
  await expect(page.locator('.backup-summary')).toContainText('0 门课程');
  await page.locator('.settings-section input[type=file]').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(snapshot!),
  });
  await expect(page.locator('.backup-summary')).toContainText('5 门课程');
  await page.getByRole('button', { name: '切换深色模式', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
test('存储损坏时保留原始数据并显示恢复入口', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.setItem('learnflow:v1:/learnflow/', 'broken-json'));
  await page.reload();
  await expect(page.getByRole('heading', { name: '找回你的学习空间' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('learnflow:v1:/learnflow/'))).toBe(
    'broken-json',
  );
});
test('存储写入失败必须提示且不能伪装保存成功', async ({ page }) => {
  await page.goto('./#/course/laser/laser-0');
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
  });
  await page.getByRole('button', { name: '我懂了', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('未能保存');
  await expect(page.getByLabel('掌握程度')).toHaveValue('unlearned');
});
test('手机布局、深链接与桌面截图', async ({ page }) => {
  await page.goto('./');
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  await page.goto('./#/course/laser/laser-0');
  await page.screenshot({ path: 'test-results/workspace-desktop.png', fullPage: true });
  await page.getByRole('button', { name: '切换深色模式', exact: true }).click();
  await page.screenshot({ path: 'test-results/workspace-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'ABCD 矩阵', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/workspace-mobile.png', fullPage: true });
  await page.goto('./');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('自建题库、改父节点、关系删除后均能持久化', async ({ page }) => {
  await page.goto('./#/course/laser/laser-1');
  await page.getByRole('button', { name: '添加题目', exact: true }).click();
  await page.getByLabel('题目', { exact: true }).fill('q 参数包含哪些物理信息？');
  await page.getByLabel('参考答案', { exact: true }).fill('束宽和波前曲率。');
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await page
    .locator('.assistant-panel')
    .getByRole('button', { name: '考我一道', exact: true })
    .click();
  await expect(page.locator('.quiz h4')).toContainText('q 参数包含');
  await page.getByRole('button', { name: '编辑当前知识结构' }).click();
  await page.getByLabel('父节点', { exact: true }).selectOption('laser-0');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('button', { name: '移除关系ABCD 矩阵' }).click();
  await page.reload();
  await expect(page.locator('.question-bank')).toContainText('q 参数包含');
  await expect(page.locator('.relation-tag')).toHaveCount(0);
  await page.getByRole('button', { name: '编辑当前知识结构' }).click();
  await expect(page.getByLabel('父节点', { exact: true })).toHaveValue('laser-0');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '删除题目', exact: true }).click();
  await expect(page.locator('.question-row')).toHaveCount(0);
});

test('另一标签页的笔记更新会同步到当前标签页', async ({ page, context }) => {
  await page.goto('./#/course/laser/laser-0');
  const other = await context.newPage();
  await other.goto('./#/course/laser/laser-0');
  await other.getByLabel('自己的理解', { exact: true }).fill('另一标签页保存的理解');
  await expect(page.getByLabel('自己的理解', { exact: true })).toHaveValue('另一标签页保存的理解');
  await page.getByLabel('容易混淆的地方', { exact: true }).fill('顺序需要注意');
  await other.reload();
  await expect(other.getByLabel('自己的理解', { exact: true })).toHaveValue('另一标签页保存的理解');
  await expect(other.getByLabel('容易混淆的地方', { exact: true })).toHaveValue('顺序需要注意');
});
