import { uid, type KnowledgeNode, type Question } from '../domain/model';
export interface QuestionContext {
  node: KnowledgeNode;
  questions: Question[];
}
export interface QuestionProvider {
  generateQuestion(context: QuestionContext): Promise<Question>;
}
export class MockQuestionProvider implements QuestionProvider {
  async generateQuestion({ node, questions }: QuestionContext): Promise<Question> {
    const saved = questions.filter((q) => q.nodeId === node.id);
    if (saved.length) return { ...saved[Math.floor(Math.random() * saved.length)] };
    const examples = node.content.examples
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      id: uid(),
      nodeId: node.id,
      prompt: examples.length
        ? `请独立完成或说明解题步骤：\n${examples[Math.floor(Math.random() * examples.length)]}`
        : `不用看笔记，解释「${node.title}」的核心思想，并举一个应用例子。`,
      answer:
        node.content.understanding ||
        node.content.concept ||
        '暂无参考答案。请对照教材或课堂笔记核对关键概念、条件和步骤。',
    };
  }
}
