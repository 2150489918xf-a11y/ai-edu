import { reactive, watch } from 'vue';

const COURSE_CHAT_STORAGE_KEY = 'eduai.mock.courseChats';
const CLASSROOM_STORAGE_KEY = 'eduai.mock.classroom';

function readSavedCourseChats() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(COURSE_CHAT_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function persistCourseChats() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(COURSE_CHAT_STORAGE_KEY, JSON.stringify(store.courseChats));
}

function readSavedClassroom() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(window.localStorage.getItem(CLASSROOM_STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

function persistClassroom() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CLASSROOM_STORAGE_KEY, JSON.stringify(store.classroom));
}

export const store = reactive({
  selectedCourseId: 'math-monotonicity',
  selectedBankId: 'newton-laws-bank',
  toast: null,
  courseChats: readSavedCourseChats(),
  courses: [
    {
      id: 'math-monotonicity',
      title: '高一函数单调性',
      shortTitle: '高一 ・ 函数单调性',
      grade: '高一',
      subject: '数学',
      duration: '40 分钟',
      status: '进行中',
      statusTone: 'normal',
      icon: 'trending_up',
      updatedAt: '05/30 10:12',
      progress: 78,
      hasOutline: true,
      goal: '通过图像、表格和解析式理解函数单调区间，并能完成基础判断。',
      summary: '包含函数图像观察、例题精讲与分层练习，已生成 12 张课件。',
      tags: ['高一', '数学', '40 min'],
      todos: '剩余校对 2 段',
      knowledge: ['图像观察', '定义辨析', '单调区间']
    },
    {
      id: 'chem-equation',
      title: '初三化学方程式',
      shortTitle: '初三 ・ 化学方程式',
      grade: '初三',
      subject: '化学',
      duration: '45 分钟',
      status: '已完成',
      statusTone: 'normal',
      icon: 'assignment_turned_in',
      updatedAt: '05/26 16:20',
      progress: 100,
      hasOutline: true,
      goal: '掌握方程式配平、实验现象描述和典型题型迁移。',
      summary: '复习方程式配平与实验现象描述，已沉淀完整教案与课件。',
      tags: ['初三', '化学', '45 min'],
      todos: '可直接复用',
      knowledge: ['质量守恒', '配平方法', '实验现象']
    }
  ],
  courseTemplates: {
    'math-quadratic': {
      id: 'math-quadratic',
      title: '高中数学《二次函数图像与性质》',
      shortTitle: '高一 · 二次函数图像与性质',
      grade: '高一',
      subject: '数学',
      duration: '45 分钟',
      status: '进行中',
      statusTone: 'normal',
      icon: 'functions',
      updatedAt: '刚刚',
      progress: 62,
      hasOutline: true,
      goal: '理解二次函数图像、顶点、对称轴、开口方向和最值，能用配方法解决基础问题。',
      summary: '基于知识库资料生成二次函数思维导图，并继续生成 PPT、题目和讲解脚本。',
      tags: ['高一', '数学', '45 min'],
      todos: '待生成思维导图',
      knowledge: ['二次函数', '对称轴', '顶点坐标', '配方法', '图像性质']
    },
    'physics-newton-2': {
      id: 'physics-newton-2',
      title: '高中物理《牛顿第二定律》',
      shortTitle: '高一 ・ 牛顿第二定律',
      grade: '高一',
      subject: '物理',
      duration: '45 分钟',
      status: '未开始',
      statusTone: 'warn',
      icon: 'science',
      updatedAt: '05/31 19:43',
      progress: 0,
      hasOutline: false,
      goal: '理解力、质量与加速度关系，能用 F=ma 解释和解决基础运动问题。',
      summary: '用于课堂讲解力、质量与加速度关系，含实验探究、公式建构和即时检测。',
      tags: ['高一', '物理', '45 min'],
      todos: '待生成课程大纲',
      knowledge: ['力与加速度', '质量与惯性', '合力方向', 'F=ma 应用']
    }
  },
  outlines: {
    'physics-newton-2': {
      version: 'v3',
      tags: ['力与加速度', '实验探究', '受力分析', '课堂检测'],
      sections: [
        {
          time: '0-8 分钟',
          phase: '情境导入',
          title: '情境导入：为什么同样推力效果不同',
          cards: [
            ['教学意图', '用推购物车和空车对比，引出力、质量、运动变化。'],
            ['教师动作', '播放短视频并追问影响加速度的因素。'],
            ['学生产出', '提出 F、m、a 之间可能存在定量关系。']
          ]
        },
        {
          time: '8-25 分钟',
          phase: '实验探究 ・ AI 重写',
          title: '实验探究：力、质量与加速度关系',
          cards: [
            ['关键内容', '控制变量，对比小车在不同拉力和质量下的加速度。'],
            ['教师动作', '演示器材，提醒平衡摩擦力和数据记录方式。'],
            ['学生产出', '用表格归纳 a 与 F 成正比、与 m 成反比。']
          ]
        },
        {
          time: '25-38 分钟',
          phase: '概念建构',
          title: '概念建构：F=ma 与单位换算',
          cards: [
            ['关键内容', '建立牛顿第二定律表达式，说明合力方向与加速度方向一致。'],
            ['教师动作', '板书公式含义，标出 N、kg、m/s² 的关系。'],
            ['学生产出', '解释定律并完成两道基础计算。']
          ]
        },
        {
          time: '38-45 分钟',
          phase: '课堂检测',
          title: '课堂检测：受力分析与计算',
          cards: [
            ['检测方式', '选择题、计算题、口头追问各 1 组。'],
            ['风险知识点', '把单个力误当合力、忽略加速度方向。'],
            ['后续材料', '复用大纲生成 PPT、教案和课中题目。']
          ]
        }
      ]
    }
  },
  slides: [
    {
      id: 1,
      label: '封面',
      kind: 'cover',
      title: '牛顿第二定律',
      subtitle: '力与运动的交响诗',
      footer: '高一 ・ 物理 ・ 王老师',
      marker: '01'
    },
    {
      id: 2,
      label: '目录',
      title: '课堂目录',
      subtitle: '从情景导入、定律解读到实验探究与应用升华',
      bullets: ['开篇：从苹果落地到星辰大海', '定律解读：力与运动的数学语言', '实验探究、思政融合、巩固应用与总结升华']
    },
    {
      id: 3,
      label: '导入',
      title: '情景导入：身边的“力与运动”',
      subtitle: '01 开篇 · 从苹果落地到星辰大海',
      bullets: ['F1 赛车：巨大牵引力带来极致加速度', '长征火箭：推力克服引力，推动火箭升空', '复兴号：持续牵引力维持高速平稳运行']
    },
    {
      id: 4,
      label: '历史',
      title: '历史的回响：牛顿的“奇迹之年”',
      subtitle: '科学探索需要不畏艰难、坚持不懈、追求真理',
      bullets: ['1665 年，牛顿在独处中深入思考自然规律', '微积分、光学、万有引力等成果奠定科学基础', '把困境转化为潜心研究的契机，传承科学家精神']
    },
    {
      id: 5,
      label: '定律',
      title: '核心概念：牛顿第二定律',
      subtitle: '物体加速度与合外力成正比，与质量成反比',
      bullets: ['F合 = m · a，力是产生加速度的原因', '加速度方向始终与合外力方向保持一致', '合外力越大加速度越大，质量越大加速度越小']
    },
    {
      id: 6,
      label: '公式',
      title: 'F = ma',
      subtitle: '用数学语言描述力、质量与加速度',
      bullets: ['F：合外力，改变物体运动状态的原因，单位 N', 'm：质量，惯性大小的量度，单位 kg', 'a：加速度，描述速度变化快慢，单位 m/s²']
    },
    {
      id: 7,
      label: '特性',
      title: '牛顿第二定律的三个特性',
      subtitle: '矢量性、瞬时性、独立性',
      bullets: ['矢量性：加速度方向始终与合外力方向相同', '瞬时性：力发生变化，加速度立刻随之变化', '独立性：不同方向受力各自产生独立加速度']
    },
    {
      id: 8,
      label: '实验',
      title: '实验探究：a 与 F 的关系',
      subtitle: '保持小车质量不变，改变拉力并记录数据',
      bullets: ['控制变量：保持 m 不变，增减钩码改变拉力 F', '图像分析：绘制 a-F 图像，得到过原点的倾斜直线', '实验证明：误差范围内 a ∝ F']
    },
    {
      id: 9,
      label: '实验',
      title: '探究加速度 a 与质量 m 的关系',
      subtitle: '保持拉力 F 恒定，改变小车总质量',
      bullets: ['核心方法：控制变量法', '实验步骤：调试装置，改变质量并记录加速度', '数据结论：绘制 a-1/m 图像，证明 a ∝ 1/m']
    },
    {
      id: 10,
      label: '航天',
      title: '中国航天：牛顿定律的伟大实践',
      subtitle: '04 思政融合 · 从物理定律到强国梦想',
      bullets: ['火箭发射：利用 F=ma 精确计算所需推力', '飞船变轨：反推获得加速度，精准调整轨道', '思政启示：攻坚克难、精益求精，用科学知识报效祖国']
    },
    {
      id: 11,
      label: '长征',
      title: '长征系列运载火箭',
      subtitle: '逐梦星辰的力学基石',
      bullets: ['核心原理：发动机巨大推力克服重力与阻力', '动态控制：多级加速、逐级分离、精准入轨', '航天精神：特别能吃苦、特别能战斗、特别能攻关、特别能奉献']
    },
    {
      id: 12,
      label: '人生',
      title: '人生启示：做自己人生的“合外力”',
      subtitle: '把物理规律迁移到个人成长',
      bullets: ['m：自身积淀，代表知识储备、专业能力和品格', 'a：成长跃迁，代表成长进步的效率', 'F：核心动力，代表决心、毅力与不懈努力']
    },
    {
      id: 13,
      label: '例题',
      title: '经典例题解析',
      subtitle: '质量 2kg 的物体受 10N 拉力和 2N 摩擦力',
      bullets: ['受力分析：向右拉力 10N，向左摩擦力 2N', '求合外力：F合 = 10N - 2N = 8N，方向向右', '代入公式：a = F合 / m = 4 m/s²']
    },
    {
      id: 14,
      label: '练习',
      title: '课堂练习',
      subtitle: '概念辨析与综合计算',
      bullets: ['选择题：F=ma 中 F 是物体受到的合外力', '计算题：汽车关闭发动机后减速，求阻力大小', '解题关键：先求加速度，再由 F=ma 求合力']
    },
    {
      id: 15,
      label: '总结',
      title: '总结与升华',
      subtitle: '知识回顾、科学精神与科技强国',
      bullets: ['核心定律：F合 = ma 揭示加速度、合外力、质量关系', '解题逻辑：受力分析、求合外力、代入公式', '思政升华：基础科学是大国基石，主动作为才能加速前行']
    },
    {
      id: 16,
      label: '致谢',
      title: '感谢聆听',
      subtitle: '愿你成为自己人生的“合外力”，加速前行！',
      bullets: ['THANKS FOR LISTENING', '回顾牛顿第二定律', '把科学精神带进学习与生活']
    }
  ],
  questionBanks: [
    {
      id: 'newton-laws-bank',
      title: '牛顿定律课堂题库',
      subject: '高中物理',
      count: 86,
      updatedAt: '今天 09:18',
      usage: '课前 / 课中 / 课后',
      desc: '覆盖牛顿第二定律、受力分析、合力与加速度方向、基础计算。',
      tags: ['牛顿第二定律', '受力分析', '课堂检测']
    },
    {
      id: 'inertia-motion-bank',
      title: '惯性与运动状态题库',
      subject: '高中物理',
      count: 64,
      updatedAt: '05/30 16:02',
      usage: '复习巩固',
      desc: '围绕牛顿第一定律、惯性现象解释和生活情境迁移。',
      tags: ['惯性', '运动状态', '现象解释']
    },
    {
      id: 'function-bank',
      title: '函数单调性题库',
      subject: '高一数学',
      count: 112,
      updatedAt: '05/29 11:35',
      usage: '分层练习',
      desc: '图像识别、定义辨析、区间书写和易错点诊断。',
      tags: ['图像', '定义', '区间']
    }
  ],
  questions: [
    {
      id: 'newton-q1',
      bankId: 'newton-laws-bank',
      type: '单选题',
      stage: '课中',
      difficulty: '基础',
      title: '质量为 2 kg 的物体在水平光滑面上受到 6 N 水平拉力，物体的加速度大小为多少？',
      options: ['A. 1 m/s²', 'B. 2 m/s²', 'C. 3 m/s²', 'D. 12 m/s²'],
      answer: 'C',
      analysis: '水平光滑面上合力等于拉力，根据 F=ma，a=F/m=6/2=3 m/s²。',
      accuracy: 76,
      inClass: true
    },
    {
      id: 'newton-q2',
      bankId: 'newton-laws-bank',
      type: '多选题',
      stage: '课前',
      difficulty: '理解',
      title: '关于牛顿第二定律，下列说法正确的是哪些？',
      options: ['A. 加速度方向与合力方向相同', 'B. 物体速度越大，合力一定越大', 'C. 同一物体所受合力越大，加速度越大', 'D. 质量越大，加速度一定越小'],
      answer: 'A、C',
      analysis: '合力决定加速度，而不是速度；质量对加速度的影响要在合力相同的条件下讨论。',
      accuracy: 62,
      inClass: true
    },
    {
      id: 'newton-q3',
      bankId: 'newton-laws-bank',
      type: '计算题',
      stage: '课后',
      difficulty: '提升',
      title: '一辆小车质量 0.5 kg，受到水平拉力 1.8 N，摩擦力 0.3 N，求小车加速度。',
      options: ['写出受力分析', '求合力', '代入公式', '说明方向'],
      answer: '3 m/s²，方向与拉力方向一致',
      analysis: '合力 F=1.8-0.3=1.5 N，a=F/m=1.5/0.5=3 m/s²。',
      accuracy: 54,
      inClass: false
    },
    {
      id: 'newton-q4',
      bankId: 'newton-laws-bank',
      type: '判断题',
      stage: '课中',
      difficulty: '易错',
      title: '只要物体受到力，物体的速度就一定变大。',
      options: ['正确', '错误'],
      answer: '错误',
      analysis: '力会改变运动状态，可能改变速度大小，也可能只改变方向，还取决于合力方向。',
      accuracy: 48,
      inClass: true
    },
    {
      id: 'inertia-q1',
      bankId: 'inertia-motion-bank',
      type: '单选题',
      stage: '课前',
      difficulty: '基础',
      title: '公交车突然刹车时，乘客身体向前倾的主要原因是什么？',
      options: ['A. 受到向前的力', 'B. 惯性', 'C. 受到重力变大', 'D. 摩擦力消失'],
      answer: 'B',
      analysis: '乘客上半身由于惯性保持原来的运动状态，所以相对车厢向前倾。',
      accuracy: 81,
      inClass: false
    }
  ],
  classroom: {
    pptId: 'newton-2',
    courseId: null,
    currentSlideIndex: 5,
    panelOpen: false,
    selectedQuestionId: null,
    assignedQuestionId: null,
    assignedQuestionSnapshot: null,
    phase: 'ready',
    answered: 0,
    total: 43,
    accuracy: 0,
    distribution: [
      { label: 'A', value: 10 },
      { label: 'B', value: 14 },
      { label: 'C', value: 33 },
      { label: 'D', value: 5 }
    ]
  },
  courseQuestionReferences: {
    'math-monotonicity': [],
    'chem-equation': []
  },
  afterClass: {
    courseId: null,
    summary: {
      attendance: '43/45',
      interactions: 128,
      avgAccuracy: 68,
      weakPoints: ['合力方向判断', '摩擦力参与的 F=ma', '单位换算']
    },
    records: [
      { id: 'math-monotonicity', name: '高一函数单调性', time: '05/30 15:10', questions: 6, accuracy: 74, status: '可查看' },
      { id: 'chem-equation', name: '初三化学方程式', time: '05/29 09:50', questions: 5, accuracy: 81, status: '可复用' }
    ],
    questionAnalysis: {
      'newton-q1': {
        correct: 33,
        wrong: 10,
        avgTime: '42 秒',
        advice: '大多数学生已掌握直接代入 F=ma，仍需强调合力与单个拉力的区别。',
        options: [
          { label: 'A', percent: 12, note: '把质量误作分母两次' },
          { label: 'B', percent: 9, note: '计算粗心' },
          { label: 'C', percent: 76, note: '正确' },
          { label: 'D', percent: 3, note: '误用 F×m' }
        ]
      },
      'newton-q3': {
        correct: 23,
        wrong: 20,
        avgTime: '96 秒',
        advice: '学生主要漏减摩擦力，建议下节课先复盘受力分析。',
        options: [
          { label: '写出受力分析', percent: 79, note: '大部分能画出拉力' },
          { label: '求合力', percent: 54, note: '薄弱步骤' },
          { label: '代入公式', percent: 67, note: '公式掌握尚可' },
          { label: '说明方向', percent: 41, note: '表达不完整' }
        ]
      }
    }
  }
});

const savedClassroom = readSavedClassroom();
if (savedClassroom) {
  Object.assign(store.classroom, savedClassroom);
}

if (typeof window !== 'undefined') {
  watch(
    () => store.classroom,
    persistClassroom,
    { deep: true }
  );
  window.addEventListener('storage', (event) => {
    if (event.key !== CLASSROOM_STORAGE_KEY || !event.newValue) return;
    try {
      Object.assign(store.classroom, JSON.parse(event.newValue));
    } catch {
      // Ignore malformed mock sync payloads.
    }
  });
}

let toastTimer = 0;

export function notify(message) {
  window.clearTimeout(toastTimer);
  store.toast = { id: Date.now(), message };
  toastTimer = window.setTimeout(() => {
    store.toast = null;
  }, 1800);
}

export function getCourse(courseId = store.selectedCourseId) {
  return store.courses.find((course) => course.id === courseId) || store.courseTemplates[courseId] || store.courses[0];
}

export function getOutline(courseId = store.selectedCourseId) {
  return store.outlines[courseId] || store.outlines['physics-newton-2'];
}

export function getBank(bankId = store.selectedBankId) {
  return store.questionBanks.find((bank) => bank.id === bankId) || store.questionBanks[0];
}

export function getQuestionsByBank(bankId = store.selectedBankId) {
  return store.questions.filter((question) => question.bankId === bankId);
}

export function saveGeneratedQuestionsToBank(bankId = store.selectedBankId, drafts = []) {
  const timestamp = Date.now();
  const generatedQuestions = drafts.map((draft, index) => ({
    ...draft,
    id: `ai-newton-${timestamp}-${index + 1}`,
    bankId,
    options: draft.options || ['A. 变为原来的 2 倍', 'B. 变为原来的一半', 'C. 保持不变', 'D. 变为原来的 4 倍'],
    answer: draft.answer || (draft.type === '计算题' ? '4 m/s²，方向与拉力方向一致' : 'A'),
    accuracy: 0,
    inClass: false
  }));
  store.questions.push(...generatedQuestions);
  const bank = getBank(bankId);
  bank.count = getQuestionsByBank(bankId).length;
  bank.updatedAt = '刚刚';
  return generatedQuestions;
}

export function getQuestion(questionId) {
  if (!questionId) return null;
  return store.questions.find((question) => question.id === questionId) || null;
}

export function getCourseQuestionRefs(courseId = store.selectedCourseId) {
  if (!store.courseQuestionReferences[courseId]) {
    store.courseQuestionReferences[courseId] = [];
  }
  return store.courseQuestionReferences[courseId];
}

export function getCourseQuestions(courseId = store.selectedCourseId) {
  return getCourseQuestionRefs(courseId)
    .map((ref) => {
      const question = getQuestion(ref.questionId);
      return question ? { ...question, courseStatus: ref.status, courseAddedAt: ref.addedAt } : null;
    })
    .filter(Boolean);
}

export function getAnsweredCourseQuestions(courseId = store.selectedCourseId) {
  return getCourseQuestions(courseId).filter((question) => question.courseStatus === 'completed' && store.afterClass.questionAnalysis[question.id]);
}

export function referenceQuestionToCourse(questionId, courseId = store.selectedCourseId) {
  const refs = getCourseQuestionRefs(courseId);
  const existing = refs.find((ref) => ref.questionId === questionId);
  if (existing) {
    existing.status = existing.status || 'referenced';
  } else {
    refs.push({ questionId, status: 'referenced', source: 'bank', addedAt: '刚刚' });
  }
  store.selectedCourseId = courseId;
  store.classroom.selectedQuestionId = questionId;
  notify('已在本课程中引用该题');
}

export function createMockCourse(payload) {
  const id = `course-${Date.now()}`;
  const course = {
    id,
    title: payload.title,
    shortTitle: `${payload.grade} ・ ${payload.topic}`,
    grade: payload.grade,
    subject: payload.subject,
    duration: payload.duration,
    status: '未开始',
    statusTone: 'warn',
    icon: 'article',
    updatedAt: '刚刚',
    progress: 0,
    hasOutline: false,
    goal: payload.goal,
    summary: '新建课程已保存，可继续生成大纲和课件。',
    tags: [payload.grade, payload.subject, payload.duration],
    todos: '待生成课程大纲',
    knowledge: payload.knowledge
  };

  store.courses.unshift(course);
  store.outlines[id] = { ...store.outlines['physics-newton-2'] };
  store.courseChats[id] = {
    scriptStep: 0,
    messages: [
      { role: 'ai', text: '王老师，我们先从一门空白新课开始。你可以先告诉我：这节课的学段、学科和主题是什么？' }
    ]
  };
  persistCourseChats();
  store.selectedCourseId = id;
  return course;
}

export function getCourseChat(courseId) {
  if (!store.courseChats[courseId]) {
    const course = getCourse(courseId);
    store.courseChats[courseId] = {
      scriptStep: course.infoReady ? 2 : 0,
      messages: [
        {
          role: 'ai',
          text: course.infoReady
            ? '我会沿用这门课已经沉淀的上下文，继续帮你调整大纲、课件和课堂活动。'
            : '王老师，我们先从一门空白新课开始。你可以先告诉我：这节课的学段、学科和主题是什么？'
        }
      ]
    };
  }
  return store.courseChats[courseId];
}

export function appendCourseChatMessage(courseId, message) {
  getCourseChat(courseId).messages.push(message);
  persistCourseChats();
}

export function streamCourseChatMessage(courseId, message, options = {}) {
  const delay = options.delay ?? 3000;
  const interval = options.interval ?? 36;
  const fullText = message.text || '';
  const streamed = { ...message, text: '' };
  const chat = getCourseChat(courseId);
  chat.messages.push(streamed);
  persistCourseChats();
  window.setTimeout(() => {
    options.onStart?.();
    let index = 0;
    const timer = window.setInterval(() => {
      index += options.chunkSize ?? 2;
      streamed.text = fullText.slice(0, index);
      persistCourseChats();
      if (index >= fullText.length) {
        window.clearInterval(timer);
        options.onDone?.();
      }
    }, interval);
  }, delay);
  return streamed;
}

export function setCourseChatScriptStep(courseId, scriptStep) {
  getCourseChat(courseId).scriptStep = scriptStep;
  persistCourseChats();
}

export function createOutlineDraftCourse() {
  const id = `course-${Date.now()}`;
  const course = {
    id,
    title: '新建课程',
    shortTitle: '新建课程草稿',
    grade: '待确认',
    subject: '待确认',
    duration: '待确认',
    status: '未开始',
    statusTone: 'warn',
    icon: 'auto_awesome',
    updatedAt: '刚刚',
    progress: 0,
    hasOutline: false,
    isDraft: true,
    infoReady: false,
    materialUploaded: false,
    materialName: '',
    goal: '待和 AI 讨论确认',
    summary: '新建课程草稿，等待确认主题、年级、学科和课时时长。',
    tags: ['AI 备课', '待确认'],
    todos: '等待 AI 收集课程信息',
    knowledge: []
  };

  store.courses.unshift(course);
  store.outlines[id] = { ...store.outlines['physics-newton-2'] };
  store.courseQuestionReferences[id] = [];
  store.classroom.courseId = id;
  store.classroom.selectedQuestionId = null;
  store.classroom.assignedQuestionId = null;
  store.classroom.assignedQuestionSnapshot = null;
  store.classroom.phase = 'ready';
  store.classroom.answered = 0;
  store.classroom.accuracy = 0;
  store.selectedCourseId = id;
  return course;
}

export function updateDraftCourseFromChat(courseId) {
  const course = getCourse(courseId);
  course.title = '高中物理《牛顿第二定律》';
  course.shortTitle = '高一 ・ 牛顿第二定律';
  course.grade = '高一';
  course.subject = '物理';
  course.duration = '45 分钟';
  course.goal = '通过生活情境、控制变量实验和课堂检测，理解力、质量与加速度的定量关系。';
  course.summary = 'AI 已确认课程主题和基础信息，可直接生成第一版大纲。',
  course.tags = ['高一', '物理', '45 min'];
  course.todos = '可生成课程大纲，上传资料为可选增强';
  course.knowledge = ['力与加速度关系', '质量对加速度影响', 'F=ma', '合力方向'];
  course.infoReady = true;
  course.progress = Math.max(course.progress, 18);
}

export function markDraftMaterialUploaded(courseId, materialName = '教材片段-牛顿第二定律.pdf') {
  const course = getCourse(courseId);
  course.materialUploaded = true;
  course.materialName = materialName;
  course.knowledge = ['力与加速度关系', '质量对加速度影响', 'F=ma', '合力方向', '单位换算'];
  course.summary = 'AI 已解析上传资料，并增强了本节课核心知识点。';
  course.todos = '可生成课程大纲';
  course.progress = Math.max(course.progress, 34);
}

export function markOutlineGenerated(courseId) {
  const course = getCourse(courseId);
  course.hasOutline = true;
  course.progress = Math.max(course.progress, 58);
}

export function addQuestionToClass(questionId) {
  referenceQuestionToCourse(questionId, store.selectedCourseId);
}

export function assignClassQuestion(questionId) {
  const courseId = store.classroom.courseId || store.selectedCourseId;
  const ref = getCourseQuestionRefs(courseId).find((item) => item.questionId === questionId);
  if (!ref) return;
  store.selectedCourseId = courseId;
  if (ref) ref.status = 'answering';
  store.classroom.assignedQuestionId = questionId;
  store.classroom.selectedQuestionId = questionId;
  store.classroom.assignedQuestionSnapshot = getQuestion(questionId);
  store.classroom.phase = 'answering';
  store.classroom.answered = 31;
  store.classroom.accuracy = 63;
}

export function finishClassQuestion() {
  store.classroom.phase = 'result';
  store.classroom.answered = store.classroom.total;
  store.classroom.accuracy = 76;
  const question = getQuestion(store.classroom.selectedQuestionId);
  if (!question) return;
  const courseId = store.classroom.courseId || store.selectedCourseId;
  const ref = getCourseQuestionRefs(courseId).find((item) => item.questionId === question.id);
  if (ref) ref.status = 'completed';
  question.accuracy = store.classroom.accuracy;
  if (!store.afterClass.questionAnalysis[question.id]) {
    store.afterClass.questionAnalysis[question.id] = {
      correct: Math.round((store.classroom.total * store.classroom.accuracy) / 100),
      wrong: store.classroom.total - Math.round((store.classroom.total * store.classroom.accuracy) / 100),
      avgTime: '54 秒',
      advice: 'AI 已根据课堂答题数据生成分析：优先复盘合力、方向和单位表达。',
      options: store.classroom.distribution.map((item) => ({
        label: item.label,
        percent: item.value,
        note: item.label === question.answer ? '正确选项' : '需要追问原因'
      }))
    };
  }
  const course = getCourse(courseId);
  const existingRecord = store.afterClass.records.find((record) => record.id === courseId);
  if (existingRecord) {
    existingRecord.questions = getAnsweredCourseQuestions(courseId).length;
    existingRecord.accuracy = store.classroom.accuracy;
    existingRecord.status = '已生成报告';
    existingRecord.time = '刚刚';
  } else {
    store.afterClass.records.unshift({
      id: courseId,
      name: course.title,
      time: '刚刚',
      questions: getAnsweredCourseQuestions(courseId).length,
      accuracy: store.classroom.accuracy,
      status: '已生成报告'
    });
  }
}

export function resetClassQuestion() {
  store.classroom.phase = 'ready';
  store.classroom.assignedQuestionId = null;
  store.classroom.assignedQuestionSnapshot = null;
  store.classroom.answered = 0;
  store.classroom.accuracy = 0;
}
