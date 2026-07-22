import assert from 'node:assert/strict';
import { createServer } from 'node:http';

const requests = [];
const server = createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  requests.push({ method: req.method, url: req.url, body });
  if (req.url.includes('/reports/stream')) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.end('event: delta\ndata: {"text":"分析"}\n\nevent: section\ndata: {"section":{"summary":{}}}\n\nevent: report\ndata: {"report":{"id":"r1"}}\n\nevent: done\ndata: {"provider":"deepseek"}\n\n');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ data: { ok: true } }));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
globalThis.__EDUAI_API_BASE_URL__ = `http://127.0.0.1:${server.address().port}`;
const client = await import(`../src/data/courseAnalysisApiClient.js?test=${Date.now()}`);

await client.fetchCourseAnalysis('course 1', { classId: 'class 1', sessionId: 'session 1' }, { force: true });
await client.fetchCourseQuestionDetail('course 1', 'question 1', { classId: 'class 1' }, { force: true });
await client.fetchCourseAnalysisReportContext('report 1', { force: true });
const events = [];
await client.streamCourseAnalysisReport('course 1', { classId: 'class 1' }, { onDelta: (value) => events.push(['delta', value]), onSection: () => events.push(['section']), onReport: (value) => events.push(['report', value.id]), onDone: () => events.push(['done']) });

assert.match(requests[0].url, /courses\/course%201\/analysis\?classId=class\+1&sessionId=session\+1/);
assert.match(requests[1].url, /questions\/question%201\?classId=class\+1/);
assert.match(requests[2].url, /course-analysis-reports\/report%201\/context/);
assert.deepEqual(events, [['delta', '分析'], ['section'], ['report', 'r1'], ['done']]);

delete globalThis.__EDUAI_API_BASE_URL__;
await new Promise((resolve) => server.close(resolve));
console.log('course analysis API client contracts passed');
