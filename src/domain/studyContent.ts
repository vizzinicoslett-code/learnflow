import type { KnowledgeNode, Resource } from './model';
import { assertCleanText } from '../services/parsers/shared';

export function textIssue(text: string): string | undefined {
  try {
    assertCleanText(text);
  } catch (error) {
    return error instanceof Error ? error.message : '提取文字无法可靠识别。';
  }
}

export function nodeTextIssue(node: KnowledgeNode): string | undefined {
  // User-authored notes and formulas are never rewritten or treated as extraction output.
  if (!node.source || !node.generatedBy) return undefined;
  return [node.title, node.summary ?? node.content.concept, node.source.quote ?? '']
    .map(textIssue)
    .find(Boolean);
}

export const isStudyTopic = (node: KnowledgeNode): boolean =>
  node.kind === 'topic' && !node.contentIssue && !nodeTextIssue(node);

export function materialTextIssue(resource: Resource): string | undefined {
  for (const page of resource.extraction?.pages ?? []) {
    const issue = textIssue(page.text) ?? textIssue(page.title);
    if (issue) {
      const location =
        page.page === null
          ? '正文片段'
          : resource.type === 'PPTX'
            ? `Slide ${page.page}`
            : `第 ${page.page} 页`;
      return `${location}：${issue}`;
    }
  }
  return resource.analysis ? textIssue(resource.analysis.summary) : undefined;
}
