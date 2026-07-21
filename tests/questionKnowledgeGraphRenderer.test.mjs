import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const renderer = readFileSync(new URL('../src/components/knowledge/KnowledgeGraphRenderer.vue', import.meta.url), 'utf8');
const inspector = readFileSync(new URL('../src/components/knowledge/KnowledgeGraphInspector.vue', import.meta.url), 'utf8');

assert.ok(renderer.includes("emit('select-node'"));
assert.ok(renderer.includes("emit('select-edge'"));
assert.ok(renderer.includes('questionCount'));
assert.ok(renderer.includes('supportCount'));
assert.ok(renderer.includes("countUnit: { type: String, default: '道题' }"));
assert.ok(renderer.includes("countLegend: { type: String, default: '节点越大表示关联题目越多' }"));
assert.ok(renderer.includes('${node.questionCount} ${props.countUnit}'));
assert.ok(renderer.includes('{{ countLegend }}'));
assert.ok(!renderer.includes('co_occurrence'));
assert.ok(renderer.includes('projectTeachingPathGraph'));
assert.ok(renderer.includes('stageLanes'));
assert.ok(renderer.includes("type: 'cubic-horizontal'"));
assert.ok(renderer.includes("visibility: visible ? 'visible' : 'hidden'"));
assert.ok(renderer.includes('isStageLane'));
assert.match(
  renderer,
  /if \(node\.isStageLane\)[\s\S]*labelPlacement: 'top-left',[\s\S]*labelTextAlign: 'left'/,
  'stage lane labels should start inside the lane instead of extending left of it'
);
assert.ok(!renderer.includes("type: 'antv-dagre'"));
assert.ok(!renderer.includes("'drag-element'"));
assert.ok(!renderer.includes("emit('layout-change'"));
assert.ok(renderer.includes('const COMPACT_LAYOUT'));
assert.ok(renderer.includes('padding: COMPACT_LAYOUT.fitPadding'));
assert.ok(renderer.includes('minNodeWidth: 116'));
assert.ok(renderer.includes('maxNodeWidth: 172'));
assert.ok(renderer.includes('fitView'));
assert.ok(renderer.includes('prerequisite'));
assert.ok(renderer.includes('path-highlight'));
assert.ok(renderer.includes('fit-canvas'));
assert.ok(!renderer.includes("type: 'radial'"));
assert.ok(
  renderer.includes('refreshGraphState'),
  'renderer should refresh selected node styles without rebuilding the graph'
);
assert.ok(
  !renderer.includes('props.activeNodeId, props.activeEdgeId, props.searchText, props.neighborhoodDepth],\n  renderGraph'),
  'changing the active node should not destroy and recreate the graph layout'
);
assert.ok(
  renderer.includes('graphRenderKey'),
  'renderer should derive a stable graph key for polling updates'
);
assert.ok(renderer.includes('let renderQueue = Promise.resolve()'));
assert.ok(renderer.includes('function requestGraphRender()'));
assert.ok(renderer.includes('function enqueueGraphOperation(operation)'));
assert.ok(renderer.includes('function requestGraphStateRefresh()'));
assert.ok(renderer.includes('function requestGraphResize()'));
assert.ok(renderer.includes('function requestFitCanvas(animation = false)'));
assert.ok(renderer.includes('const nextGraph = new Graph'));
assert.ok(renderer.includes('await nextGraph.render()'));
assert.ok(renderer.includes('if (!graphReady || !graph) return'));
assert.ok(renderer.includes('watch(graphRenderKey, requestGraphRender)'));
assert.ok(!renderer.includes('watch(graphRenderKey, renderGraph)'));
assert.ok(!renderer.includes('props.activeNodeId, props.activeEdgeId, props.searchText'));
assert.ok(
  !renderer.includes("watch(() => props.graphData, renderGraph, { deep: true })"),
  'unchanged polling responses should not destroy and recreate the graph canvas'
);
assert.ok(inspector.includes("emit('save-node'"));
assert.ok(inspector.includes("emit('merge-node'"));
assert.ok(inspector.includes("emit('create-relation'"));
assert.ok(inspector.includes("emit('select-relation'"));
assert.ok(inspector.includes('前置知识'));
assert.ok(inspector.includes('后续路径'));
assert.ok(inspector.includes('辅助关系'));
assert.ok(inspector.includes('关联题目'));

console.log('question knowledge graph renderer contracts passed');
