import {
  generatedPaper,
  knowledgeBaseCategories,
  knowledgeMaterials,
  newtonClassLearningAnalysis as classLearningAnalysis,
  newtonParentLearningSummary,
  newtonStudentProfiles as studentProfiles,
  quadraticMindMap,
} from './teachingMockData.js';

const materialState = knowledgeMaterials.map((item) => ({ ...item }));

function delay(ms = 700) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

function matchesSearch(material, keyword) {
  if (!keyword) return true;
  const haystack = [
    material.title,
    material.subject,
    material.grade,
    material.source,
    ...material.tags,
    ...material.knowledgePoints.map((item) => item.name)
  ].join(' ');
  return haystack.toLowerCase().includes(String(keyword).trim().toLowerCase());
}

export async function getKnowledgeBaseMaterials(filters = {}) {
  await delay(filters.fast ? 0 : 600);
  const materials = materialState.filter((item) => {
    if (filters.categoryId && filters.categoryId !== 'all' && item.categoryId !== filters.categoryId) return false;
    if (filters.type && filters.type !== 'all' && item.type !== filters.type) return false;
    if (filters.status && filters.status !== 'all' && item.status !== filters.status) return false;
    return matchesSearch(item, filters.keyword);
  });
  return {
    categories: knowledgeBaseCategories,
    materials
  };
}

export async function uploadKnowledgeMaterial(fileMeta = {}) {
  await delay(800);
  const material = {
    id: `mat-upload-${Date.now()}`,
    title: fileMeta.name?.replace(/\.[^.]+$/, '') || '二次函数单元教学补充资料',
    type: fileMeta.type || 'PDF',
    subject: '数学',
    grade: '高一',
    categoryId: 'math-g10',
    size: fileMeta.size || '1.9 MB',
    pages: 12,
    uploadedAt: '刚刚',
    status: 'parsing',
    parseLabel: '解析中',
    source: '老师上传',
    chunks: 0,
    evidenceCount: 0,
    vectorIndexed: false,
    bm25Indexed: false,
    teacherPinned: false,
    usedByCourses: [],
    tags: ['待解析'],
    knowledgePoints: [],
    retrievalSummary: null,
    evidenceTypes: [],
    availableActions: []
  };
  materialState.unshift(material);
  return material;
}

export async function parseKnowledgeMaterial(materialId) {
  await delay(1200);
  const material = materialState.find((item) => item.id === materialId);
  if (!material) return null;
  Object.assign(material, {
    status: 'parsed',
    parseLabel: '已解析',
    chunks: 28,
    evidenceCount: 34,
    vectorIndexed: true,
    bm25Indexed: true,
    tags: ['二次函数', '对称轴', '配方法'],
    knowledgePoints: [
      { id: 'kp-quadratic-basic', name: '二次函数一般式' },
      { id: 'kp-axis', name: '对称轴' },
      { id: 'kp-vertex', name: '顶点坐标' },
      { id: 'kp-square', name: '配方法' }
    ],
    retrievalSummary: {
      bm25: 0.77,
      vector: 0.88,
      knowledgeMatch: 0.92,
      teachingWeight: 0.82
    },
    evidenceTypes: ['material_chunk', 'teacher_note'],
    availableActions: ['生成思维导图', '生成课程大纲', '生成 PPT']
  });
  return material;
}

export async function bindMaterialsToCourse(payload = {}) {
  await delay(700);
  const courseName = payload.courseName || '二次函数图像与性质';
  materialState
    .filter((item) => payload.materialIds?.includes(item.id))
    .forEach((item) => {
      if (!item.usedByCourses.includes(courseName)) {
        item.usedByCourses.push(courseName);
      }
    });
  return {
    courseId: payload.courseId || 'math-quadratic',
    materialIds: payload.materialIds || [],
    evidencePackReady: true,
    message: '资料已引用到课程，可用于生成思维导图和课件'
  };
}

export async function buildEvidencePack(payload = {}) {
  await delay(1000);
  return {
    taskType: payload.taskType || 'mindmap',
    materialIds: payload.materialIds || [],
    evidenceIds: ['ev-material-001', 'ev-material-002', 'ev-report-001'],
    coverage: 92,
    retrievalProfile: payload.taskType === 'ppt'
      ? 'ppt_generate_from_materials'
      : 'mindmap_generate_from_materials'
  };
}

export async function generateMindMap(courseId = 'math-quadratic') {
  await delay(900);
  return {
    courseId,
    steps: [
      '读取已引用资料',
      '抽取知识点与公式',
      '聚类图像性质和解题方法',
      '合并学情薄弱点',
      '生成思维导图'
    ],
    mindMap: {
      ...quadraticMindMap,
      courseId
    }
  };
}

export async function getClassLearningAnalysis(classId = 'class-2026-math-1', options = {}) {
  await delay(options.fast ? 0 : 700);
  return {
    ...classLearningAnalysis,
    classId,
    questionStats: classLearningAnalysis.questionStats.map((item) => ({
      ...item,
      optionDistribution: item.optionDistribution.map((option) => ({ ...option }))
    })),
    weakPoints: classLearningAnalysis.weakPoints.map((item) => ({ ...item }))
  };
}

export async function getStudentProfile(studentId = 'stu-liming', options = {}) {
  await delay(options.fast ? 0 : 700);
  const profile = studentProfiles.find((item) => item.id === studentId) || studentProfiles[0];
  return {
    ...profile,
    mastery: profile.mastery.map((item) => ({ ...item })),
    weakPoints: [...profile.weakPoints],
    mistakeReasons: [...profile.mistakeReasons],
    recommendedPractice: profile.recommendedPractice.map((item) => ({ ...item })),
    parentSummary: profile.parentSummary
      ? {
          ...profile.parentSummary,
          mastered: [...profile.parentSummary.mastered],
          needsAttention: [...profile.parentSummary.needsAttention]
        }
      : undefined
  };
}

export async function getStudentProfileList(filters = {}) {
  await delay(filters.fast ? 0 : 600);
  const classes = [...new Set(studentProfiles.map((item) => item.className))];
  const filteredStudents = studentProfiles.filter((student) => {
    if (!filters.className || filters.className === '全部班级') return true;
    return student.className === filters.className;
  });

  return {
    classes: ['全部班级', ...classes],
    students: filteredStudents.map((student) => {
      const mastery = student.mastery.map((item) => ({ ...item }));
      const lowestMastery = [...mastery].sort((a, b) => a.value - b.value)[0] || null;
      const avgMastery = mastery.length
        ? Math.round(mastery.reduce((sum, item) => sum + item.value, 0) / mastery.length)
        : 0;

      return {
        id: student.id,
        name: student.name,
        className: student.className,
        attendance: student.attendance,
        practiceCount: student.practiceCount,
        avgMastery,
        lowestMastery,
        weakPoints: [...student.weakPoints],
        aiConversationSummary: student.aiConversationSummary
      };
    })
  };
}

export async function getParentLearningSummary(studentId = 'stu-liming', options = {}) {
  await delay(options.fast ? 0 : 600);
  const profile = studentProfiles.find((item) => item.id === studentId) || studentProfiles[0];
  return {
    studentId: profile.id,
    studentName: profile.name,
    weeklyStatus: profile.parentSummary.weeklyStatus,
    mastered: [...profile.parentSummary.mastered],
    needsAttention: [...profile.parentSummary.needsAttention],
    suggestion: profile.parentSummary.suggestion
  };
}

export async function generateExamPaper(bankId = 'newton-laws-bank', config = {}, options = {}) {
  await delay(options.fast ? 0 : 1300);
  return {
    bankId,
    config,
    paper: {
      ...generatedPaper,
      difficultyDistribution: generatedPaper.difficultyDistribution.map((item) => ({ ...item })),
      knowledgeCoverage: generatedPaper.knowledgeCoverage.map((item) => ({ ...item })),
      qualityChecks: generatedPaper.qualityChecks.map((item) => ({ ...item })),
      questions: generatedPaper.questions.map((item) => ({ ...item }))
    }
  };
}

export async function saveExamPaper(paperId = generatedPaper.id, options = {}) {
  await delay(options.fast ? 0 : 600);
  return {
    paperId,
    status: 'saved',
    message: '试卷已保存到当前题库'
  };
}
