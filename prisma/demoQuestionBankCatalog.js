const CATEGORY_BY_INDEX = ['基础概念', '基础概念', '核心规律', '核心规律', '方法策略', '综合应用'];

function point(key, name, summary, answer) {
  return { key, name, summary, answer, category: '' };
}

function buildQuestions(bankKey, points) {
  return points.flatMap((item, pointIndex) => {
    const choiceNumber = pointIndex * 2 + 1;
    const fillNumber = choiceNumber + 1;
    return [
      {
        id: `demo-q-${bankKey}-${choiceNumber}`,
        type: 'single_choice',
        stage: pointIndex < 2 ? '课前' : pointIndex < 5 ? '课中' : '课后',
        difficulty: pointIndex < 2 ? '基础' : pointIndex < 5 ? '中等' : '提高',
        title: `关于“${item.name}”，下列说法正确的是？`,
        options: [
          `A. ${item.summary}`,
          'B. 只需记住结论，不必关注适用条件',
          'C. 该知识点与题目给出的条件无关',
          'D. 该知识点只适用于课外拓展题'
        ],
        answer: { value: `A. ${item.summary}` },
        analysis: `本题考查${item.name}。${item.summary}`,
        knowledgeKeys: [item.key]
      },
      {
        id: `demo-q-${bankKey}-${fillNumber}`,
        type: 'fill_blank',
        stage: pointIndex < 2 ? '课前' : pointIndex < 5 ? '课中' : '课后',
        difficulty: pointIndex < 2 ? '基础' : pointIndex < 5 ? '中等' : '提高',
        title: `请填写“${item.name}”中的核心关键词或结论：____。`,
        options: [],
        answer: { value: item.answer },
        analysis: `${item.name}的核心结论是“${item.answer}”。${item.summary}`,
        knowledgeKeys: pointIndex === 0 ? [item.key] : [points[pointIndex - 1].key, item.key]
      }
    ];
  });
}

function buildBank({ key, title, subject, courseId, description, tags, points }) {
  const knowledgePoints = points.map((item, index) => ({
    ...item,
    category: CATEGORY_BY_INDEX[index]
  }));
  return {
    id: `demo-bank-${key}`,
    title,
    subject,
    grade: '高一',
    courseId,
    usage: '课前诊断 / 课堂练习 / 课后巩固',
    description,
    tags,
    knowledgePoints,
    relations: knowledgePoints.slice(0, -1).map((item, index) => ({
      source: item.key,
      target: knowledgePoints[index + 1].key,
      type: 'prerequisite',
      label: index < 2 ? '基础支撑' : index < 4 ? '规律进阶' : '综合应用'
    })),
    questions: buildQuestions(key, knowledgePoints)
  };
}

const bankDefinitions = [
  {
    key: 'physics-motion', title: '匀变速直线运动专题题库', subject: '物理', courseId: 'dev-course-motion',
    description: '覆盖速度、加速度、运动学公式、图像分析与追及相遇问题。', tags: ['运动学', '加速度', '图像'],
    points: [
      point('velocity', '速度与速率', '速度描述位移随时间的变化率，并且具有方向。', '位移变化率'),
      point('acceleration', '加速度', '加速度描述速度变化的快慢和方向。', '速度变化率'),
      point('motion-formula', '匀变速运动公式', '位移和速度公式只适用于加速度恒定的直线运动。', 'v=v₀+at'),
      point('motion-graph', '运动图像', 'v-t 图像斜率表示加速度，面积表示位移。', '斜率表示加速度'),
      point('meeting-problem', '追及与相遇', '建立同一参考系并利用位移关系确定相遇时刻。', '位移关系'),
      point('motion-modeling', '运动学综合建模', '先分过程再选择公式，可避免跨阶段误用条件。', '分过程建模')
    ]
  },
  {
    key: 'physics-force-equilibrium', title: '力的合成与平衡专题题库', subject: '物理', courseId: 'dev-course-force-composition',
    description: '覆盖力的图示、矢量合成、共点力平衡和受力分析。', tags: ['力的合成', '平衡', '受力分析'],
    points: [
      point('force-vector', '力的矢量性', '力同时具有大小、方向和作用点。', '大小、方向、作用点'),
      point('resultant-force', '合力与分力', '合力与分力是等效替代关系，不能重复计入受力图。', '等效替代'),
      point('parallelogram-rule', '平行四边形定则', '两个共点力的合力由平行四边形对角线确定。', '对角线'),
      point('equilibrium-condition', '共点力平衡', '物体平衡时各方向合力均为零。', '合力为零'),
      point('force-diagram', '受力图', '只画研究对象实际受到的力，并标明方向。', '实际受力'),
      point('force-comprehensive', '多力平衡建模', '合理建立坐标轴并将各力正交分解可简化计算。', '正交分解')
    ]
  },
  {
    key: 'physics-energy', title: '机械能与功专题题库', subject: '物理', courseId: 'course-newton-2',
    description: '覆盖功、功率、动能定理、重力势能与机械能守恒。', tags: ['功', '机械能', '守恒'],
    points: [
      point('work', '功', '恒力做功等于力、位移及夹角余弦的乘积。', 'W=Fs cosθ'),
      point('power', '功率', '功率表示做功快慢，平均功率等于功与时间之比。', 'P=W/t'),
      point('kinetic-energy', '动能', '动能由质量和速度大小共同决定。', 'Ek=mv²/2'),
      point('work-energy', '动能定理', '合外力做功等于物体动能的变化量。', 'W合=ΔEk'),
      point('potential-energy', '重力势能', '重力势能变化只与初末位置的高度差有关。', 'Ep=mgh'),
      point('energy-conservation', '机械能守恒', '只有重力或弹力做功时系统机械能守恒。', '机械能守恒条件')
    ]
  },
  {
    key: 'physics-momentum', title: '动量与碰撞专题题库', subject: '物理', courseId: 'dev-course-force-composition',
    description: '覆盖动量、冲量、动量定理、系统守恒与碰撞模型。', tags: ['动量', '冲量', '碰撞'],
    points: [
      point('momentum', '动量', '动量等于质量与速度的乘积，方向与速度一致。', 'p=mv'),
      point('impulse', '冲量', '恒力冲量等于力与作用时间的乘积。', 'I=Ft'),
      point('impulse-momentum', '动量定理', '合外力冲量等于物体动量的变化量。', 'I合=Δp'),
      point('momentum-conservation', '动量守恒', '系统所受合外力冲量为零时总动量守恒。', '合外力冲量为零'),
      point('collision', '碰撞模型', '碰撞过程中先选系统和正方向，再列动量守恒式。', '选系统与正方向'),
      point('momentum-comprehensive', '动量能量综合', '完全弹性碰撞同时满足动量守恒和机械能守恒。', '双守恒')
    ]
  },
  {
    key: 'math-functions', title: '函数概念与性质专题题库', subject: '数学', courseId: 'dev-course-function-basic',
    description: '覆盖函数定义、定义域、值域、单调性、奇偶性和图像变换。', tags: ['函数', '定义域', '性质'],
    points: [
      point('function-definition', '函数概念', '函数要求定义域内每个自变量都有唯一函数值。', '唯一对应'),
      point('domain', '定义域', '定义域由表达式有意义及实际问题约束共同确定。', '自变量取值范围'),
      point('range', '值域', '值域是函数值实际能够取得的集合。', '函数值集合'),
      point('monotonicity', '单调性', '单调性必须在指定区间内比较自变量与函数值变化。', '指定区间'),
      point('parity', '奇偶性', '判断奇偶性前应先验证定义域关于原点对称。', '定义域对称'),
      point('graph-transform', '函数图像变换', '平移与伸缩应区分自变量内部变化和函数值外部变化。', '内横外纵')
    ]
  },
  {
    key: 'math-quadratic', title: '二次函数专题题库', subject: '数学', courseId: 'dev-course-quadratic',
    description: '覆盖开口方向、对称轴、顶点、零点、最值与参数讨论。', tags: ['二次函数', '图像', '最值'],
    points: [
      point('quadratic-form', '二次函数一般式', '二次项系数不为零是二次函数成立的必要条件。', 'a≠0'),
      point('axis', '对称轴', '二次函数图像的对称轴为 x=-b/(2a)。', 'x=-b/(2a)'),
      point('vertex', '顶点与开口', '二次项系数决定开口方向，顶点决定最值位置。', '顶点'),
      point('zero-discriminant', '零点与判别式', '判别式符号决定二次方程实根个数。', 'Δ=b²-4ac'),
      point('quadratic-range', '区间最值', '区间最值要同时比较顶点和区间端点。', '顶点与端点'),
      point('parameter-discussion', '参数分类讨论', '含参数问题应依据开口、对称轴位置和判别式分类。', '分类讨论')
    ]
  },
  {
    key: 'math-trigonometry', title: '三角函数基础专题题库', subject: '数学', courseId: 'dev-course-triangle',
    description: '覆盖弧度制、任意角、同角关系、诱导公式和图像性质。', tags: ['三角函数', '弧度制', '图像'],
    points: [
      point('radian', '弧度制', '一个弧度对应弧长等于半径时的圆心角。', '弧长等于半径'),
      point('unit-circle', '单位圆定义', '任意角三角函数可由终边与单位圆交点坐标定义。', '单位圆坐标'),
      point('basic-identity', '同角三角关系', '正弦平方与余弦平方之和恒等于一。', 'sin²x+cos²x=1'),
      point('induction-formula', '诱导公式', '诱导公式的符号由终边所在象限确定。', '奇变偶不变，符号看象限'),
      point('trig-graph', '三角函数图像', '正弦函数周期为 2π，振幅由函数前系数决定。', '周期与振幅'),
      point('trig-modeling', '三角函数模型', '周期现象可通过振幅、周期、相位和平移量建模。', '四类参数')
    ]
  },
  {
    key: 'math-vectors', title: '平面向量专题题库', subject: '数学', courseId: 'dev-course-triangle',
    description: '覆盖向量概念、线性运算、坐标表示、数量积和平行垂直判定。', tags: ['向量', '数量积', '坐标'],
    points: [
      point('vector-definition', '向量概念', '向量是既有大小又有方向的量。', '大小和方向'),
      point('vector-operation', '向量线性运算', '向量加法满足平行四边形定则或三角形法则。', '三角形法则'),
      point('vector-coordinate', '向量坐标', '终点坐标减起点坐标得到向量坐标。', '终点减起点'),
      point('dot-product', '向量数量积', '数量积等于模的乘积再乘夹角余弦。', 'a·b=|a||b|cosθ'),
      point('parallel-perpendicular', '平行与垂直', '坐标形式下可用比例关系判平行、数量积为零判垂直。', '比例与零数量积'),
      point('vector-geometry', '向量解决几何问题', '建立合适基底可将几何关系转化为代数运算。', '基底法')
    ]
  },
  {
    key: 'chem-amount', title: '物质的量专题题库', subject: '化学', courseId: 'dev-course-amount',
    description: '覆盖摩尔、阿伏加德罗常数、摩尔质量、气体摩尔体积和浓度。', tags: ['物质的量', '摩尔', '浓度'],
    points: [
      point('mole', '物质的量', '物质的量是联系微观粒子数与宏观可测量量的桥梁。', '摩尔'),
      point('avogadro', '阿伏加德罗常数', '一摩尔粒子所含粒子数约为 6.02×10²³。', '6.02×10²³ mol⁻¹'),
      point('molar-mass', '摩尔质量', '物质质量与物质的量之比为摩尔质量。', 'M=m/n'),
      point('molar-volume', '气体摩尔体积', '使用气体摩尔体积必须同时关注温度和压强条件。', '温度和压强'),
      point('molar-concentration', '物质的量浓度', '溶质物质的量除以溶液体积得到物质的量浓度。', 'c=n/V'),
      point('amount-conversion', '多步换算', '复杂换算以物质的量为中心连接质量、体积和粒子数。', '以 n 为中心')
    ]
  },
  {
    key: 'chem-redox', title: '氧化还原反应专题题库', subject: '化学', courseId: 'dev-course-redox',
    description: '覆盖化合价变化、电子转移、氧化剂还原剂和方程式配平。', tags: ['氧化还原', '电子转移', '配平'],
    points: [
      point('valence-change', '化合价变化', '元素化合价升降是判断氧化还原反应的重要标志。', '化合价升降'),
      point('electron-transfer', '电子转移', '化合价升高表示失电子，降低表示得电子。', '升失氧，降得还'),
      point('oxidant-reductant', '氧化剂与还原剂', '氧化剂得电子被还原，还原剂失电子被氧化。', '氧化剂得电子'),
      point('redox-product', '氧化产物与还原产物', '还原剂被氧化后的生成物是氧化产物。', '反应后的对应产物'),
      point('redox-balance', '电子守恒配平', '氧化剂得电子总数必须等于还原剂失电子总数。', '得失电子守恒'),
      point('redox-application', '氧化还原综合判断', '综合题应依次标价、判变价、找剂与产物并检查守恒。', '标判找查')
    ]
  },
  {
    key: 'chem-ionic', title: '离子反应专题题库', subject: '化学', courseId: 'dev-course-redox',
    description: '覆盖电解质、电离、离子方程式、共存与检验。', tags: ['离子反应', '电解质', '离子方程式'],
    points: [
      point('electrolyte', '电解质', '电解质是在水溶液或熔融状态能导电的化合物。', '化合物'),
      point('ionization', '电离', '电解质在水溶液或熔融状态产生自由移动离子。', '产生自由离子'),
      point('ionic-equation', '离子方程式', '离子方程式保留实际参加反应的粒子及其化学计量关系。', '实际反应粒子'),
      point('write-ionic', '离子方程式书写', '书写要遵循写、拆、删、查四个步骤。', '写拆删查'),
      point('ion-coexistence', '离子共存', '离子间若生成沉淀、气体、弱电解质或发生氧化还原则不能大量共存。', '反应则不共存'),
      point('ion-identification', '离子检验', '检验离子要选择特征反应并排除其他离子的干扰。', '特征反应与排干扰')
    ]
  },
  {
    key: 'english-relative-clauses', title: '定语从句专题题库', subject: '英语', courseId: 'dev-course-relative-clause',
    description: '覆盖先行词、关系代词、关系副词、限制性从句和介词前置。', tags: ['定语从句', '语法', '关系词'],
    points: [
      point('antecedent', '先行词', '先行词是被定语从句修饰的名词或代词。', '被修饰的名词或代词'),
      point('relative-pronoun', '关系代词', 'who、whom、which、that 在从句中充当主语或宾语。', '充当句子成分'),
      point('relative-adverb', '关系副词', 'when、where、why 在从句中通常充当状语。', '充当状语'),
      point('restrictive-clause', '限制性定语从句', '限制性定语从句与先行词关系紧密，通常不用逗号隔开。', '不用逗号隔开'),
      point('preposition-relative', '介词加关系词', '介词后指人常用 whom，指物常用 which。', 'whom 或 which'),
      point('clause-analysis', '定语从句综合辨析', '先找先行词，再判断从句缺少何种成分来选择关系词。', '先行词与缺失成分')
    ]
  },
  {
    key: 'english-reading', title: '英语阅读理解专题题库', subject: '英语', courseId: 'dev-course-reading',
    description: '覆盖主旨、细节、推断、词义猜测、篇章结构和观点态度。', tags: ['阅读理解', '主旨', '推断'],
    points: [
      point('main-idea', '主旨大意', '主旨应覆盖全文核心内容，不能只概括局部细节。', '全文核心'),
      point('detail-location', '细节定位', '利用题干关键词回到原文定位并进行同义转换。', '关键词定位'),
      point('inference', '推理判断', '合理推断必须以原文事实为依据，不能过度延伸。', '有据推断'),
      point('word-meaning', '词义猜测', '结合上下文、构词法和逻辑关系推断词义。', '上下文线索'),
      point('text-structure', '篇章结构', '段落功能和连接词可以揭示文章组织方式。', '段落功能'),
      point('author-attitude', '作者态度', '通过评价性词语、语气和论证倾向判断作者态度。', '评价词与语气')
    ]
  },
  {
    key: 'chinese-modern-reading', title: '现代文阅读专题题库', subject: '语文', courseId: 'dev-course-modern-prose',
    description: '覆盖信息筛选、概括、结构、语言赏析、形象与主旨。', tags: ['现代文', '阅读', '文本分析'],
    points: [
      point('information-screening', '信息筛选', '围绕题干限定词定位原文，并区分原文与推断。', '限定词定位'),
      point('content-summary', '内容概括', '概括应保留核心对象、事件和结果，语言简明。', '对象事件结果'),
      point('structure-analysis', '结构分析', '分析段落在内容、结构和表达效果上的作用。', '内容结构表达'),
      point('language-appreciation', '语言赏析', '从词语、句式、修辞和语境效果四方面赏析。', '词句修辞语境'),
      point('character-image', '人物形象', '人物形象应依据言行、心理、环境和侧面描写概括。', '文本依据'),
      point('theme-exploration', '主旨探究', '主旨判断需综合标题、关键句、情节和作者态度。', '多证据互证')
    ]
  },
  {
    key: 'chinese-classical', title: '文言文基础专题题库', subject: '语文', courseId: 'dev-course-classical',
    description: '覆盖实词、虚词、词类活用、特殊句式、翻译和文意理解。', tags: ['文言文', '翻译', '实词虚词'],
    points: [
      point('content-word', '文言实词', '理解实词应结合本义、语境和古今词义变化。', '语境定词义'),
      point('function-word', '文言虚词', '虚词意义和用法要根据其句法位置与前后成分判断。', '句法位置'),
      point('word-usage', '词类活用', '词类活用需结合词在句中的语法功能确定。', '语法功能'),
      point('special-sentence', '特殊句式', '判断省略、倒装、判断和被动句有助于理清句意。', '四类句式'),
      point('translation', '文言翻译', '翻译坚持直译为主，落实关键词并补出省略成分。', '信达雅'),
      point('classical-comprehension', '文意综合理解', '理解全文应梳理人物、事件、因果和作者评价。', '人物事件因果')
    ]
  }
];

export const demoQuestionBankCatalog = bankDefinitions.map(buildBank);
