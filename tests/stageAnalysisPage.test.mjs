import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/StageAnalysisPage.vue', import.meta.url), 'utf8');
assert.match(source, /courseAnalysisApiClient/);
assert.match(source, /fetchCourseAnalysis/);
assert.match(source, /fetchCourseQuestionDetail/);
assert.match(source, /streamCourseAnalysisReport/);
assert.doesNotMatch(source, /mockStore/);
assert.doesNotMatch(source, /newton-laws-bank|牛顿第二定律/);
assert.match(source, /router\.replace/);
assert.match(source, /classId/);
assert.match(source, /sessionId/);
assert.match(source, /aiGenerating/);
assert.match(source, /openQuestionDetail/);
assert.match(source, /bankDialogOpen/);
assert.match(source, /analysisReportId/);
assert.match(source, /listQuestionBanks/);

console.log('stage analysis page contract passed');
