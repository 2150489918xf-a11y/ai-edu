import assert from 'node:assert/strict';

import {
  projectTeachingPathGraph,
  TEACHING_STAGES
} from '../src/components/knowledge/teachingPathProjection.js';

assert.deepEqual(TEACHING_STAGES.map((stage) => stage.label), [
  '基础概念',
  '核心规律',
  '解题方法',
  '综合应用'
]);

const fourStage = projectTeachingPathGraph({
  nodes: [
    { id: 'base', label: '加速度', category: '基础', questionCount: 3 },
    { id: 'law', label: '牛顿第二定律', category: '规律', questionCount: 10 },
    { id: 'method', label: '受力分析', category: '方法', questionCount: 6 },
    { id: 'application', label: '斜面问题', category: '应用', questionCount: 4 },
    { id: 'orphan', label: '待归类', category: '其他', questionCount: 1 }
  ],
  edges: [
    { id: 'e1', source: 'base', target: 'law', type: 'prerequisite' },
    { id: 'e2', source: 'law', target: 'method', type: 'application' },
    { id: 'e3', source: 'method', target: 'application', type: 'application' },
    { id: 'cross', source: 'base', target: 'application', type: 'application' }
  ]
});

assert.deepEqual(
  fourStage.nodes.filter((node) => !node.orphan).map((node) => node.stageIndex),
  [0, 1, 2, 3]
);
assert.equal(fourStage.nodes.find((node) => node.id === 'orphan').stageIndex, 0);
assert.ok(fourStage.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)));
assert.equal(fourStage.edges.find((edge) => edge.id === 'e1').defaultVisible, true);
assert.equal(fourStage.edges.find((edge) => edge.id === 'cross').defaultVisible, false);
assert.equal(fourStage.stageLanes.length, 4);
assert.ok(fourStage.stageLanes.every((lane) => Number.isFinite(lane.x) && Number.isFinite(lane.height)));

const deepGraph = projectTeachingPathGraph({
  nodes: Array.from({ length: 6 }, (_, index) => ({ id: `n${index}`, label: `节点 ${index}` })),
  edges: Array.from({ length: 5 }, (_, index) => ({
    id: `d${index}`,
    source: `n${index}`,
    target: `n${index + 1}`,
    type: 'prerequisite'
  }))
});

assert.deepEqual(deepGraph.nodes.map((node) => node.stageIndex), [0, 1, 1, 2, 2, 3]);
assert.equal(deepGraph.edges.find((edge) => edge.id === 'd1').defaultVisible, false);
assert.equal(deepGraph.edges.find((edge) => edge.id === 'd2').defaultVisible, true);

const threeLayer = projectTeachingPathGraph({
  nodes: [
    { id: 'start', label: '起点' },
    { id: 'middle', label: '中间' },
    { id: 'end', label: '终点' }
  ],
  edges: [
    { id: 't1', source: 'start', target: 'middle', type: 'prerequisite' },
    { id: 't2', source: 'middle', target: 'end', type: 'application' }
  ]
});

assert.deepEqual(threeLayer.nodes.map((node) => node.stageIndex), [0, 1, 3]);

const stableSource = {
  nodes: [
    { id: 'b', label: 'B', category: '同类', questionCount: 2 },
    { id: 'a', label: 'A', category: '同类', questionCount: 5 },
    { id: 'root', label: 'Root', category: '起点', questionCount: 1 },
    { id: 'end', label: 'End', category: '终点', questionCount: 1 }
  ],
  edges: [
    { id: 's1', source: 'root', target: 'a', type: 'prerequisite' },
    { id: 's2', source: 'root', target: 'b', type: 'prerequisite' },
    { id: 's3', source: 'a', target: 'end', type: 'application' },
    { id: 's4', source: 'b', target: 'end', type: 'application' }
  ]
};

const stableFirst = projectTeachingPathGraph(stableSource);
const stableSecond = projectTeachingPathGraph(stableSource);
assert.deepEqual(stableFirst, stableSecond);
assert.ok(stableFirst.nodes.find((node) => node.id === 'a').y < stableFirst.nodes.find((node) => node.id === 'b').y);

console.log('question knowledge teaching path tests passed');
