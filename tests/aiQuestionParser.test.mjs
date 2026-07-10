import assert from 'node:assert/strict';

import {
  createStreamingQuestionParser,
  parseQuestionsFromAiText
} from '../src/data/aiQuestionParser.js';

const structuredReply = [
  'Here are the questions.',
  ':::questions',
  '[',
  '  {',
  '    "type": "single-choice",',
  '    "stage": "in-class",',
  '    "difficulty": "basic",',
  '    "title": "What is acceleration when F=6N and m=2kg?",',
  '    "options": ["1 m/s^2", "2 m/s^2", "3 m/s^2", "12 m/s^2"],',
  '    "answer": "3 m/s^2",',
  '    "analysis": "a = F / m = 3 m/s^2",',
  '    "knowledge": ["F=ma"]',
  '  }',
  ']',
  ':::'
].join('\n');

const parsed = parseQuestionsFromAiText(structuredReply);
assert.equal(parsed.length, 1);
assert.equal(parsed[0].title, 'What is acceleration when F=6N and m=2kg?');
assert.deepEqual(parsed[0].options, ['1 m/s^2', '2 m/s^2', '3 m/s^2', '12 m/s^2']);
assert.equal(parsed[0].answer, '3 m/s^2');
assert.deepEqual(parsed[0].knowledge, ['F=ma']);

const objectBlockReply = [
  ':::questions',
  '{',
  '  "questions": [',
  '    {',
  '      "type": "calculation",',
  '      "stage": "after-class",',
  '      "difficulty": "medium",',
  '      "title": "A 1kg block is pulled by 5N and friction is 1N. Find acceleration.",',
  '      "answer": "4 m/s^2",',
  '      "analysis": "Net force is 4N, so a=4/1=4 m/s^2.",',
  '      "knowledge": "net force"',
  '    }',
  '  ]',
  '}',
  ':::'
].join('\n');

const parsedObject = parseQuestionsFromAiText(objectBlockReply);
assert.equal(parsedObject.length, 1);
assert.equal(parsedObject[0].type, 'calculation');
assert.equal(parsedObject[0].stage, 'after-class');
assert.deepEqual(parsedObject[0].options, []);
assert.deepEqual(parsedObject[0].knowledge, ['net force']);

const invalidReply = 'AI only says it can generate questions, but no structured block is present.';
assert.deepEqual(parseQuestionsFromAiText(invalidReply), []);

const singleQuestionBlock = [
  'AI is starting.',
  ':::question-start',
  '{',
  '  "type": "single-choice",',
  '  "stage": "in-class",',
  '  "difficulty": "basic",',
  '  "title": "A streaming question appears first.",',
  '  "options": ["A", "B"],',
  '  "answer": "A",',
  '  "analysis": "Parsed before the full reply is done.",',
  '  "knowledge": ["streaming"]',
  '}',
  ':::question-end'
].join('\n');

const parsedSingleBlock = parseQuestionsFromAiText(singleQuestionBlock);
assert.equal(parsedSingleBlock.length, 1);
assert.equal(parsedSingleBlock[0].title, 'A streaming question appears first.');

const streamingParser = createStreamingQuestionParser();
assert.deepEqual(streamingParser.push('prefix :::question-start\n{"title":"Partial'), []);
const streamed = streamingParser.push(' streamed question","options":["A"],"answer":"A"}\n:::question-end tail');
assert.equal(streamed.length, 1);
assert.equal(streamed[0].title, 'Partial streamed question');
assert.equal(streamingParser.getBuffer(), ' tail');

const streamedSecond = streamingParser.push([
  ':::question-start',
  '{"title":"Second streamed question","knowledge":"F=ma"}',
  ':::question-end'
].join('\n'));
assert.equal(streamedSecond.length, 1);
assert.deepEqual(streamedSecond[0].knowledge, ['F=ma']);

const legacyStreamingParser = createStreamingQuestionParser();
const legacyChunkQuestions = legacyStreamingParser.push([
  ':::questions',
  '[',
  '{"title":"Legacy block streamed question","answer":"A"}',
  ']',
  ':::'
].join('\n'));
assert.equal(legacyChunkQuestions.length, 1);
assert.equal(legacyChunkQuestions[0].title, 'Legacy block streamed question');

console.log('AI question parser contracts passed');
