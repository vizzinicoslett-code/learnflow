import { checkAborted } from '../materialExtraction';
import { parseXml, readOfficeEntries, type ParserOutput } from './shared';
export async function parsePptx(file: File, signal: AbortSignal): Promise<ParserOutput> {
  const files = await readOfficeEntries(new Uint8Array(await file.arrayBuffer()), (p) =>
    /^(ppt\/presentation\.xml|ppt\/_rels\/presentation\.xml\.rels|ppt\/slides\/slide\d+\.xml)$/.test(
      p,
    ),
  );
  checkAborted(signal);
  if (!files['ppt/presentation.xml'] || !files['ppt/_rels/presentation.xml.rels'])
    throw new Error('缺少 PPTX 幻灯片目录或关系文件。');
  const presentation = parseXml(files['ppt/presentation.xml']);
  const rels = new Map(
    Array.from(
      parseXml(files['ppt/_rels/presentation.xml.rels']).getElementsByTagNameNS(
        '*',
        'Relationship',
      ),
    ).map((r) => [
      r.getAttribute('Id'),
      { target: r.getAttribute('Target'), external: r.getAttribute('TargetMode') === 'External' },
    ]),
  );
  const pages = Array.from(presentation.getElementsByTagNameNS('*', 'sldId')).map((s, i) => {
    checkAborted(signal);
    const id =
      s.getAttributeNS(
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
        'id',
      ) ?? s.getAttribute('r:id');
    const relationship = rels.get(id);
    const target = relationship?.target;
    const path = target?.startsWith('/') ? target.slice(1) : 'ppt/' + target?.replace(/^\.\//, '');
    if (!target || relationship?.external || !files[path]) throw new Error('PPTX 幻灯片引用无效。');
    const doc = parseXml(files[path]);
    // a:t only. Binary images, formula objects and SmartArt relationships never enter text.
    const drawing = 'http://schemas.openxmlformats.org/drawingml/2006/main';
    const paragraphs = Array.from(doc.getElementsByTagNameNS(drawing, 'p'));
    const text = paragraphs
      .map((p) =>
        Array.from(p.getElementsByTagNameNS(drawing, 't'))
          .map((t) => t.textContent ?? '')
          .join(''),
      )
      .filter(Boolean)
      .join('\n');
    return {
      page: i + 1,
      section: 'slide-' + (i + 1),
      title: text.split('\n')[0]?.slice(0, 120) || '第 ' + (i + 1) + ' 页',
      text,
    };
  });
  if (!pages.length) throw new Error('PPTX 中没有幻灯片。');
  const empty = pages.filter((p) => !p.text.trim()).map((p) => p.page);
  return {
    pages,
    warnings: [
      '已跳过图片、公式对象和 SmartArt；仅读取幻灯片文字。',
      ...(empty.length ? ['部分幻灯片没有正文，可能需要 OCR。'] : []),
    ],
    needsOCR: empty.length > 0,
    ocrPages: empty,
  };
}
