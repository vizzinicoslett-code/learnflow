import { emptyData, newNode, now, type AppData } from './model';
export function seedData(): AppData {
  const data = emptyData();
  data.courses = [
    ['laser', '激光原理', '从光与物质的相互作用，到一束激光的诞生。', '#287c68'],
    ['solid', '固体物理', '理解晶体结构与固体中的电子。', '#8c73b7'],
    ['thermal', '热力学与统计物理', '从微观概率，走向宏观规律。', '#bc8857'],
    ['optics', '物理光学', '在干涉、衍射与偏振中认识光。', '#6585b7'],
    ['microwave', '微波原理与技术', '探索电磁波的传输与应用。', '#ae7283'],
  ].map(([id, title, description, color]) => ({ id, title, description, color, createdAt: now() }));
  const chapter = newNode('laser', '光学谐振腔与高斯光束', 'chapter', null, 0);
  chapter.id = 'laser-chapter';
  const titles = ['ABCD 矩阵', '复参数 q', '高斯光束传输', '模式匹配'];
  data.nodes = [
    chapter,
    ...titles.map((title, i) => ({
      ...newNode('laser', title, 'topic', chapter.id, i),
      id: `laser-${i}`,
    })),
  ];
  const first = data.nodes[1];
  first.content = {
    concept:
      '在近轴近似下，使用 2 × 2 矩阵描述光线经过光学系统后的位置和倾角变化。多个光学元件可以通过矩阵相乘组合。',
    formula:
      '[r₂, θ₂]ᵀ = [A B; C D] [r₁, θ₁]ᵀ\n\n自由传播距离 L：M = [1 L; 0 1]\n薄透镜（焦距 f）：M = [1 0; −1/f 1]',
    understanding: '把每个光学元件看作一次变换。先经过的元件，其矩阵写在最右边。',
    confusion: '矩阵相乘的顺序不能颠倒。注意光线向量的角度约定，以及介质折射率是否发生变化。',
    examples: '一束近轴光线先传播距离 L，再经过焦距为 f 的薄透镜，写出系统的 ABCD 矩阵。',
    mistakes: '',
    notes: '这是一份可编辑的示例课程。用自己的语言补充理解，再试着不看笔记回答一道题。',
  };
  data.nodes[2].content.concept = '用复光束参数 q 同时表达高斯光束的波前曲率与束宽。';
  data.nodes[2].content.formula = '1/q = 1/R − iλ/(πw²)\nq₂ = (Aq₁ + B)/(Cq₁ + D)';
  data.edges = [0, 1, 2].map((i) => ({
    id: `edge-${i}`,
    courseId: 'laser',
    sourceId: `laser-${i}`,
    targetId: `laser-${i + 1}`,
    kind: 'prerequisite',
  }));
  data.questions = [
    {
      id: 'question-demo',
      nodeId: 'laser-0',
      prompt: '光线先自由传播距离 L，再通过焦距 f 的薄透镜。写出系统矩阵，并说明矩阵相乘的顺序。',
      answer:
        'M = M透镜 × M传播 = [1, L; −1/f, 1−L/f]。先经过的元件在右侧，后经过的在左侧。假设近轴近似、相同介质和常用 (r, θ) 约定。',
    },
  ];
  return data;
}
