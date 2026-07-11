import { createRouter, createWebHistory } from 'vue-router';
import AfterClassPage from './pages/AfterClassPage.vue';
import AdminOfficePage from './pages/admin/AdminOfficePage.vue';
import CoursesPage from './pages/CoursesPage.vue';
import HomePage from './pages/HomePage.vue';
import InClassPlayPage from './pages/InClassPlayPage.vue';
import InClassPptsPage from './pages/InClassPptsPage.vue';
import KnowledgeBasePage from './pages/KnowledgeBasePage.vue';
import LessonPlanPage from './pages/LessonPlanPage.vue';
import LoginPage from './pages/LoginPage.vue';
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
import { getAuthToken, getStoredAuthUser } from './data/authApiClient';
import { createOutlineDraftCourse, notify } from './data/mockStore';

const StudentAnalysisPage = () => import('./pages/student/StudentAnalysisPage.vue');
const StudentAiPracticeGeneratePage = () => import('./pages/student/StudentAiPracticeGeneratePage.vue');
const StudentCourseDetailPage = () => import('./pages/student/StudentCourseDetailPage.vue');
const StudentCoursesPage = () => import('./pages/student/StudentCoursesPage.vue');
const StudentPracticePage = () => import('./pages/student/StudentPracticePage.vue');
const QuestionBankKnowledgeGraphPage = () => import('./pages/QuestionBankKnowledgeGraphPage.vue');

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginPage, meta: { fullscreen: true } },
    { path: '/admin/login', name: 'admin-login', component: LoginPage, meta: { fullscreen: true } },
    { path: '/admin', name: 'admin-office', component: AdminOfficePage, meta: { fullscreen: true } },
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
    { path: '/question-banks/:bankId/knowledge-graph', name: 'question-bank-knowledge-graph', component: QuestionBankKnowledgeGraphPage },
    { path: '/question-banks/:bankId/generate', name: 'question-generate', component: QuestionGeneratePage },
    { path: '/question-banks/:bankId/paper', name: 'paper-generate', component: PaperGeneratePage },
    { path: '/questions/:questionId', name: 'question-detail', component: QuestionDetailPage },
    { path: '/in-class/ppts', name: 'in-class-ppts', component: InClassPptsPage },
    { path: '/in-class/play/:pptId', name: 'in-class-play', component: InClassPlayPage, meta: { fullscreen: true } },
    { path: '/student/login', name: 'student-login', component: LoginPage, meta: { fullscreen: true } },
    { path: '/student', redirect: '/student/courses' },
    { path: '/student/courses', name: 'student-courses', component: StudentCoursesPage, meta: { fullscreen: true } },
    { path: '/student/analysis', name: 'student-analysis', component: StudentAnalysisPage, meta: { fullscreen: true } },
    { path: '/student/analysis/practice-generate', name: 'student-ai-practice-generate', component: StudentAiPracticeGeneratePage, meta: { fullscreen: true } },
    { path: '/student/courses/:courseId', name: 'student-course-detail', component: StudentCourseDetailPage, meta: { fullscreen: true } },
    { path: '/student/tasks/:taskId/practice', name: 'student-practice', component: StudentPracticePage, meta: { fullscreen: true } },
    { path: '/student/classroom', name: 'student-classroom', component: StudentClassroomPage, meta: { fullscreen: true } },
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

function getLoggedInRole() {
  if (!getAuthToken()) return '';
  return getStoredAuthUser()?.user?.role || '';
}

router.beforeEach((to) => {
  const isStudentLogin = to.path === '/student/login';
  const isTeacherLogin = to.path === '/login';
  const isAdminLogin = to.path === '/admin/login';
  const isLoginRoute = isStudentLogin || isTeacherLogin || isAdminLogin;
  const isStudentRoute = to.path.startsWith('/student');
  const isAdminRoute = to.path.startsWith('/admin');
  const role = getLoggedInRole();

  if (isLoginRoute) {
    return true;
  }

  if (!role) {
    if (isStudentRoute) return '/student/login';
    if (isAdminRoute) return '/admin/login';
    return '/login';
  }

  if (isStudentRoute && role !== 'student') return '/student/login';
  if (isAdminRoute && role !== 'admin') return '/admin/login';
  if (!isStudentRoute && !isAdminRoute && role !== 'teacher') return '/login';
  return true;
});
