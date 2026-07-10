import {
  generatedPaper,
  knowledgeBaseCategories,
  knowledgeMaterials,
  newtonClassLearningAnalysis as classLearningAnalysis,
  newtonParentLearningSummary,
  newtonStudentProfiles as studentProfiles,
  quadraticMindMap,
} from './teachingMockData.js';
import {
  fetchClassLearningAnalysis,
  fetchParentLearningSummary,
  fetchStudentProfile,
  fetchStudentProfileList
} from './learningApiClient.js';
import {
  archiveKnowledgeCategory,
  archiveKnowledgeMaterial,
  createKnowledgeCategory,
  createKnowledgeMaterial,
  listKnowledgeCategories,
  listKnowledgeMaterials,
  updateKnowledgeCategory,
  updateKnowledgeMaterial
} from './knowledgeApiClient.js';

const categoryState = knowledgeBaseCategories.map((item) => ({ ...item }));
const materialState = knowledgeMaterials.filter(isKnowledgeMaterialRecord).map((item) => ({ ...item }));

function delay(ms = 700) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

function isKnowledgeMaterialRecord(value) {
  return Boolean(
    value &&
    value.id &&
    value.categoryId &&
    value.title &&
    value.type &&
    value.subject &&
    value.grade
  );
}

function shouldUseFallback(error) {
  return error?.message === 'Missing VITE_API_BASE_URL' || error instanceof TypeError;
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
  try {
    const categoryResult = await listKnowledgeCategories({ status: 'active', pageSize: 100 });
    const materialResult = await listKnowledgeMaterials({
      categoryId: filters.categoryId && filters.categoryId !== 'all' ? filters.categoryId : undefined,
      type: filters.type && filters.type !== 'all' ? filters.type : undefined,
      parseStatus: filters.status && filters.status !== 'all' ? filters.status : undefined,
      keyword: filters.keyword || undefined,
      status: 'active',
      pageSize: 100
    });
    return {
      categories: [
        {
          id: 'all',
          name: '全部资料',
          count: materialResult.pagination?.total || materialResult.data.length,
          icon: 'folder_open'
        },
        ...categoryResult.data
      ],
      materials: materialResult.data
    };
  } catch (error) {
    if (!shouldUseFallback(error)) throw error;
    // Fall back to in-memory demo data when the local API server is not running.
  }

  await delay(filters.fast ? 0 : 600);
  const materials = materialState.filter((item) => {
    if (filters.categoryId && filters.categoryId !== 'all' && item.categoryId !== filters.categoryId) return false;
    if (filters.type && filters.type !== 'all' && item.type !== filters.type) return false;
    if (filters.status && filters.status !== 'all' && item.status !== filters.status) return false;
    return matchesSearch(item, filters.keyword);
  });
  return {
    categories: categoryState,
    materials
  };
}

export async function uploadKnowledgeMaterial(fileMeta = {}) {
  try {
    return await createKnowledgeMaterial({
      categoryId: fileMeta.categoryId || 'math-g10',
      title: fileMeta.name?.replace(/\.[^.]+$/, '') || '二次函数单元教学补充资料',
      type: fileMeta.type || 'PDF',
      subject: fileMeta.subject || '数学',
      grade: fileMeta.grade || '高一',
      size: fileMeta.size || '1.9 MB',
      pages: fileMeta.pages || 12,
      source: fileMeta.source || '老师上传',
      parseStatus: 'parsing',
      tags: ['待解析']
    });
  } catch (error) {
    if (!shouldUseFallback(error)) throw error;
    // Fall back to in-memory demo data when the local API server is not running.
  }

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
  try {
    return await updateKnowledgeMaterial(materialId, {
      parseStatus: 'parsed',
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
  } catch (error) {
    if (!shouldUseFallback(error)) throw error;
    // Fall back to in-memory demo data when the local API server is not running.
  }

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

export async function addKnowledgeCategory(payload = {}) {
  try {
    return await createKnowledgeCategory(payload);
  } catch (error) {
    if (!shouldUseFallback(error)) throw error;
    await delay(300);
    const category = {
      id: `cat-${Date.now()}`,
      name: payload.name || '新分类',
      icon: payload.icon || 'folder_open',
      count: 0,
      status: 'active'
    };
    categoryState.push(category);
    return category;
  }
}

export async function editKnowledgeCategory(categoryId, payload = {}) {
  try {
    return await updateKnowledgeCategory(categoryId, payload);
  } catch (error) {
    if (!shouldUseFallback(error)) throw error;
    await delay(300);
    const category = categoryState.find((item) => item.id === categoryId);
    if (!category) return null;
    Object.assign(category, payload);
    return category;
  }
}

export async function removeKnowledgeCategory(categoryId) {
  try {
    return await archiveKnowledgeCategory(categoryId);
  } catch (error) {
    if (!shouldUseFallback(error)) throw error;
    await delay(300);
    const index = categoryState.findIndex((item) => item.id === categoryId);
    if (index >= 0) {
      const [category] = categoryState.splice(index, 1);
      return { ...category, status: 'archived' };
    }
    return null;
  }
}

export async function addKnowledgeMaterial(payload = {}) {
  try {
    return await createKnowledgeMaterial(payload);
  } catch (error) {
    if (!shouldUseFallback(error)) throw error;
    await delay(300);
    const material = {
      id: `mat-${Date.now()}`,
      title: payload.title || '新资料',
      type: payload.type || 'PDF',
      subject: payload.subject || '数学',
      grade: payload.grade || '高一',
      categoryId: payload.categoryId || 'math-g10',
      size: payload.size || '1 MB',
      pages: Number(payload.pages || 0),
      uploadedAt: '刚刚',
      status: payload.parseStatus || 'parsed',
      parseLabel: payload.parseStatus === 'parsing' ? '解析中' : '已解析',
      source: payload.source || '手动添加',
      chunks: Number(payload.chunks || 0),
      evidenceCount: Number(payload.evidenceCount || 0),
      vectorIndexed: Boolean(payload.vectorIndexed),
      bm25Indexed: Boolean(payload.bm25Indexed),
      teacherPinned: Boolean(payload.teacherPinned),
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      knowledgePoints: Array.isArray(payload.knowledgePoints) ? payload.knowledgePoints : [],
      retrievalSummary: payload.retrievalSummary || null,
      evidenceTypes: Array.isArray(payload.evidenceTypes) ? payload.evidenceTypes : [],
      availableActions: Array.isArray(payload.availableActions) ? payload.availableActions : [],
      usedByCourses: Array.isArray(payload.usedByCourses) ? payload.usedByCourses : []
    };
    materialState.unshift(material);
    return material;
  }
}

export async function editKnowledgeMaterial(materialId, payload = {}) {
  try {
    return await updateKnowledgeMaterial(materialId, payload);
  } catch (error) {
    if (!shouldUseFallback(error)) throw error;
    await delay(300);
    const material = materialState.find((item) => item.id === materialId);
    if (!material) return null;
    Object.assign(material, payload);
    if (payload.parseStatus) {
      material.status = payload.parseStatus;
      material.parseLabel = payload.parseStatus === 'parsing' ? '解析中' : '已解析';
    }
    return material;
  }
}

export async function removeKnowledgeMaterial(materialId) {
  try {
    return await archiveKnowledgeMaterial(materialId);
  } catch (error) {
    if (!shouldUseFallback(error)) throw error;
    await delay(300);
    const index = materialState.findIndex((item) => item.id === materialId);
    if (index >= 0) {
      const [material] = materialState.splice(index, 1);
      return { ...material, status: 'archived' };
    }
    return null;
  }
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
  if (!options.fast) {
    const remoteResult = await fetchClassLearningAnalysis(classId);
    if (remoteResult) return remoteResult;
  }

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
  if (!options.fast) {
    const remoteResult = await fetchStudentProfile(studentId);
    if (remoteResult) return remoteResult;
  }

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
  if (!filters.fast) {
    const remoteResult = await fetchStudentProfileList(filters);
    if (remoteResult) return remoteResult;
  }

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
  if (!options.fast) {
    const remoteResult = await fetchParentLearningSummary(studentId);
    if (remoteResult) return remoteResult;
  }

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
