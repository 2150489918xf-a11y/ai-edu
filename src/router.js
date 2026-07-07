import { createRouter, createWebHistory } from 'vue-router';
import AfterClassPage from './pages/AfterClassPage.vue';
import CoursesPage from './pages/CoursesPage.vue';
import HomePage from './pages/HomePage.vue';
import InClassPlayPage from './pages/InClassPlayPage.vue';
import InClassPptsPage from './pages/InClassPptsPage.vue';
import KnowledgeBasePage from './pages/KnowledgeBasePage.vue';
import LessonPlanPage from './pages/LessonPlanPage.vue';
import MindMapGeneratePage from './pages/MindMapGeneratePage.vue';
import PaperGeneratePage from './pages/PaperGeneratePage.vue';
import PptGeneratePage from './pages/PptGeneratePage.vue';
import QuestionAnalysisPage from './pages/QuestionAnalysisPage.vue';
import QuestionBankDetailPage from './pages/QuestionBankDetailPage.vue';
import QuestionBanksPage from './pages/QuestionBanksPage.vue';
import QuestionDetailPage from './pages/QuestionDetailPage.vue';
import QuestionGeneratePage from './pages/QuestionGeneratePage.vue';
import StageAnalysisPage from './pages/StageAnalysisPage.vue';
import StudentClassroomPage from './pages/StudentClassroomPage.vue';
import WorkspacePage from './pages/WorkspacePage.vue';
import { createOutlineDraftCourse, notify } from './data/mockStore';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    { path: '/preclass/courses', name: 'courses', component: CoursesPage },
    {
      path: '/preclass/courses/new',
      name: 'course-new',
      beforeEnter: () => {
        const course = createOutlineDraftCourse();
        notify('已创建课程草稿，进入 AI 大纲生成');
        return `/preclass/courses/${course.id}/workspace`;
      }
    },
    { path: '/preclass/courses/:courseId/workspace', name: 'workspace', component: WorkspacePage, meta: { fullscreen: true } },
    { path: '/preclass/courses/:courseId/mindmap', name: 'mindmap', component: MindMapGeneratePage, meta: { fullscreen: true } },
    { path: '/preclass/courses/:courseId/ppt', name: 'ppt', component: PptGeneratePage, meta: { fullscreen: true } },
    { path: '/preclass/courses/:courseId/lesson-plan', name: 'lesson-plan', component: LessonPlanPage, meta: { fullscreen: true } },
    { path: '/preclass/courses/:courseId/analysis', name: 'course-analysis', component: StageAnalysisPage, meta: { fullscreen: true } },
    { path: '/knowledge-base', name: 'knowledge-base', component: KnowledgeBasePage },
    { path: '/question-banks', name: 'question-banks', component: QuestionBanksPage },
    { path: '/question-banks/:bankId', name: 'question-bank-detail', component: QuestionBankDetailPage },
    { path: '/question-banks/:bankId/generate', name: 'question-generate', component: QuestionGeneratePage },
    { path: '/question-banks/:bankId/paper', name: 'paper-generate', component: PaperGeneratePage },
    { path: '/questions/:questionId', name: 'question-detail', component: QuestionDetailPage },
    { path: '/in-class/ppts', name: 'in-class-ppts', component: InClassPptsPage },
    { path: '/in-class/play/:pptId', name: 'in-class-play', component: InClassPlayPage, meta: { fullscreen: true } },
    { path: '/student', name: 'student-classroom', component: StudentClassroomPage, meta: { fullscreen: true } },
    { path: '/learning-analysis', name: 'learning-analysis', component: AfterClassPage },
    { path: '/after-class', name: 'after-class', component: AfterClassPage },
    { path: '/after-class/:courseId/analysis', redirect: (to) => `/preclass/courses/${to.params.courseId}/analysis` },
    { path: '/after-class/:courseId/questions/:questionId', name: 'question-analysis', component: QuestionAnalysisPage },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ],
  scrollBehavior() {
    return { top: 0 };
  }
});
