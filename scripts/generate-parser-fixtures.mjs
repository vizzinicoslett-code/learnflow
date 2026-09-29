import { chromium } from '@playwright/test';
import { zipSync, strToU8 } from 'fflate';
import { mkdir, writeFile } from 'node:fs/promises';
const folder = 'tests/fixtures';
await mkdir(folder, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(
    '<html lang="zh-CN"><style>body{font-family:"Microsoft YaHei",sans-serif;font-size:24px}section{break-after:page}section:last-child{break-after:auto}</style><section><h1>第二章 晶体的结合</h1><p>晶体结合的基本类型包括离子键、共价键和金属键。</p></section><section><h1>第三章 晶格振动</h1><p>声子的基本定义与晶格振动有关。</p></section></html>',
  );
  await page.pdf({ path: folder + '/chinese-course.pdf', format: 'A4' });
  const image = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 800;
    c.height = 300;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 800, 300);
    ctx.fillStyle = 'black';
    ctx.font = '32px Microsoft YaHei';
    ctx.fillText('扫描版课堂笔记，需要 OCR', 30, 100);
    return c.toDataURL();
  });
  await page.setContent('<img style="width:600px" src="' + image + '">');
  await page.pdf({ path: folder + '/scanned-course.pdf', format: 'A4' });
} finally {
  await browser.close();
}
const encode = (o) =>
  Object.fromEntries(
    Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? strToU8(v) : v]),
  );
const relns = 'http://schemas.openxmlformats.org/package/2006/relationships';
const mainrel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const contentns = 'http://schemas.openxmlformats.org/package/2006/content-types';
const drawing = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const presentation = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const slide = (title) =>
  '<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:p="' +
  presentation +
  '" xmlns:a="' +
  drawing +
  '"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="标题"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>' +
  title +
  '</a:t></a:r></a:p><a:p><a:r><a:t>来自课堂的中文正文：基本定义与公式。</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>';
await writeFile(
  folder + '/chinese-course.pptx',
  zipSync(
    encode({
      '[Content_Types].xml':
        '<Types xmlns="' +
        contentns +
        '"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>',
      '_rels/.rels':
        '<Relationships xmlns="' +
        relns +
        '"><Relationship Id="r1" Type="' +
        mainrel +
        '/officeDocument" Target="ppt/presentation.xml"/></Relationships>',
      'ppt/presentation.xml':
        '<p:presentation xmlns:p="' +
        presentation +
        '" xmlns:r="' +
        mainrel +
        '"><p:sldIdLst><p:sldId id="256" r:id="r2"/><p:sldId id="257" r:id="r1"/></p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>',
      'ppt/_rels/presentation.xml.rels':
        '<Relationships xmlns="' +
        relns +
        '"><Relationship Id="r1" Type="' +
        mainrel +
        '/slide" Target="slides/slide1.xml"/><Relationship Id="r2" Type="' +
        mainrel +
        '/slide" Target="slides/slide2.xml"/></Relationships>',
      'ppt/slides/slide1.xml': slide('第三章 晶格振动'),
      'ppt/slides/slide2.xml': slide('第二章 晶体的结合'),
      'ppt/media/image1.png': new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3, 255]),
    }),
  ),
);
await writeFile(
  folder + '/chinese-course.docx',
  zipSync(
    encode({
      '[Content_Types].xml':
        '<Types xmlns="' +
        contentns +
        '"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      '_rels/.rels':
        '<Relationships xmlns="' +
        relns +
        '"><Relationship Id="r1" Type="' +
        mainrel +
        '/officeDocument" Target="word/document.xml"/></Relationships>',
      'word/document.xml':
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>第二章 晶体的结合</w:t></w:r></w:p><w:p><w:r><w:t>晶体结合的基本类型包括离子键、共价键和金属键。</w:t></w:r></w:p><w:p><w:r><w:t>第三章 晶格振动</w:t></w:r></w:p><w:p><w:r><w:t>声子的基本定义与晶格振动有关。</w:t></w:r></w:p><w:sectPr/></w:body></w:document>',
    }),
  ),
);
await writeFile(
  folder + '/chinese-course.md',
  '# 第二章 晶体的结合\n晶体结合的基本类型包括离子键、共价键和金属键。\n# 第三章 晶格振动\n声子的基本定义与晶格振动有关。\n',
);
console.log('Created Chinese PDF (2 pages), PPTX (2 slides), DOCX, MD, scanned PDF fixtures.');
