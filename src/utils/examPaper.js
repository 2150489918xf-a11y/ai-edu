const SECTION_DEFS = [
  { type: '单选题', heading: '一、单项选择题', pointsPerQuestion: 5, answerLines: 0 },
  { type: '判断题', heading: '二、判断题', pointsPerQuestion: 5, answerLines: 0 },
  { type: '填空题', heading: '三、填空题', pointsPerQuestion: 10, answerLines: 1 },
  { type: '多选题', heading: '四、多项选择题', pointsPerQuestion: 10, answerLines: 0 },
  { type: '计算题', heading: '五、计算题', pointsPerQuestion: 15, answerLines: 5 },
  { type: '情境题', heading: '六、情境分析题', pointsPerQuestion: 25, answerLines: 6 }
];

const FIRST_PAGE_SECTION_LIMIT = 3;

function normalizeQuestion(question) {
  return {
    ...question,
    options: Array.isArray(question.options) ? question.options : []
  };
}

export function buildExamPaperLayout(paper) {
  const sections = SECTION_DEFS
    .map((section) => {
      const questions = paper.questions
        .filter((question) => question.type === section.type)
        .map(normalizeQuestion);
      return {
        ...section,
        questions,
        totalPoints: questions.length * section.pointsPerQuestion
      };
    })
    .filter((section) => section.questions.length);

  const sectionScores = sections.map((section) => ({
    label: section.type,
    score: section.totalPoints
  }));
  const totalScore = sectionScores.reduce((sum, item) => sum + item.score, 0);
  const pages = [
    {
      pageNumber: 1,
      includeHeader: true,
      sections: sections.slice(0, FIRST_PAGE_SECTION_LIMIT)
    },
    {
      pageNumber: 2,
      includeHeader: false,
      sections: sections.slice(FIRST_PAGE_SECTION_LIMIT)
    }
  ].filter((page) => page.sections.length);

  return {
    title: paper.title,
    examInfo: {
      subject: '高一物理',
      grade: '高一',
      fullScore: totalScore,
      durationMinutes: paper.estimatedMinutes,
      questionCount: paper.totalQuestions
    },
    scoreTable: [
      ...sectionScores,
      { label: '总分', score: totalScore }
    ],
    sections,
    pages
  };
}
