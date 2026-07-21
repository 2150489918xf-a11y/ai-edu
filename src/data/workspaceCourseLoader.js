import { getCourse as fetchCourse } from './courseApiClient.js';
import { mapApiCourseToUiCourse } from './courseUiAdapter.js';
import { getCourse as getFallbackCourse } from './mockStore.js';

export function resolveWorkspaceFallbackCourse(courseId, findCourse = getFallbackCourse) {
  const course = findCourse(courseId);
  return course?.id === String(courseId) ? course : null;
}

export async function loadWorkspaceCourse(courseId, deps = {}) {
  const fetchCourseDetail = deps.fetchCourse || fetchCourse;
  const fallbackCourse = deps.getFallbackCourse || resolveWorkspaceFallbackCourse;
  const mapCourse = deps.mapCourse || mapApiCourseToUiCourse;

  try {
    const apiCourse = await fetchCourseDetail(courseId);
    return {
      source: 'api',
      course: mapCourse(apiCourse),
      error: null
    };
  } catch (error) {
    return {
      source: 'mock',
      course: fallbackCourse(courseId),
      error
    };
  }
}
