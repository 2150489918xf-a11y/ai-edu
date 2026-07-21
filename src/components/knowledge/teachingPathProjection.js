import { projectKnowledgePathGraph } from './knowledgePathProjection.js';

export const TEACHING_STAGES = [
  { index: 0, key: 'foundation', label: '基础概念' },
  { index: 1, key: 'principle', label: '核心规律' },
  { index: 2, key: 'method', label: '解题方法' },
  { index: 3, key: 'application', label: '综合应用' }
];

const FIRST_STAGE_X = 140;
const STAGE_GAP = 240;
const NODE_START_Y = 112;
const NODE_GAP_Y = 78;
const LANE_WIDTH = 204;
const MIN_WORLD_HEIGHT = 520;
const WORLD_BOTTOM_PADDING = 112;
const LANE_TOP = 40;
const LANE_BOTTOM = 32;

function resolveStageIndex(layer, maxLayer) {
  if (layer === null || layer === undefined || maxLayer <= 0) return 0;
  if (maxLayer === 1) return layer === 0 ? 0 : 3;
  if (maxLayer === 2) return [0, 1, 3][layer];
  return Math.round((layer * 3) / maxLayer);
}

function compareTeachingNodes(left, right) {
  return left.stageIndex - right.stageIndex ||
    String(left.category).localeCompare(String(right.category)) ||
    Number(right.questionCount || 0) - Number(left.questionCount || 0) ||
    String(left.label).localeCompare(String(right.label)) ||
    String(left.id).localeCompare(String(right.id));
}

export function projectTeachingPathGraph(source = {}) {
  const path = projectKnowledgePathGraph(source);
  const maxLayer = path.nodes.reduce((maximum, node) => (
    node.layer === null ? maximum : Math.max(maximum, node.layer)
  ), 0);

  const nodes = path.nodes
    .map((node) => {
      const stageIndex = node.orphan ? 0 : resolveStageIndex(node.layer, maxLayer);
      const stage = TEACHING_STAGES[stageIndex];
      return {
        ...node,
        stageIndex,
        stageKey: stage.key,
        stageLabel: stage.label
      };
    })
    .sort(compareTeachingNodes);

  const nodesByStage = TEACHING_STAGES.map(({ index }) => (
    nodes.filter((node) => node.stageIndex === index)
  ));
  const largestStageSize = Math.max(1, ...nodesByStage.map((stageNodes) => stageNodes.length));
  const worldHeight = Math.max(
    MIN_WORLD_HEIGHT,
    NODE_START_Y + (largestStageSize - 1) * NODE_GAP_Y + WORLD_BOTTOM_PADDING
  );

  nodesByStage.forEach((stageNodes, stageIndex) => {
    const stageOffset = ((largestStageSize - stageNodes.length) * NODE_GAP_Y) / 2;
    stageNodes.forEach((node, nodeIndex) => {
      node.x = FIRST_STAGE_X + stageIndex * STAGE_GAP;
      node.y = NODE_START_Y + stageOffset + nodeIndex * NODE_GAP_Y;
    });
  });

  const nodeStageIndex = new Map(nodes.map((node) => [node.id, node.stageIndex]));
  const edges = path.edges.map((edge) => {
    const sourceStage = nodeStageIndex.get(edge.source) ?? 0;
    const targetStage = nodeStageIndex.get(edge.target) ?? 0;
    const stageDistance = targetStage - sourceStage;
    return {
      ...edge,
      sourceStage,
      targetStage,
      stageDistance,
      defaultVisible: stageDistance === 1
    };
  });

  const laneHeight = worldHeight - LANE_TOP - LANE_BOTTOM;
  const stageLanes = TEACHING_STAGES.map((stage) => ({
    ...stage,
    id: `teaching-stage-${stage.key}`,
    x: FIRST_STAGE_X + stage.index * STAGE_GAP,
    y: LANE_TOP + laneHeight / 2,
    width: LANE_WIDTH,
    height: laneHeight,
    nodeCount: nodesByStage[stage.index].length
  }));

  return {
    nodes,
    edges,
    stageLanes,
    stats: path.stats,
    layout: {
      width: FIRST_STAGE_X * 2 + STAGE_GAP * (TEACHING_STAGES.length - 1),
      height: worldHeight,
      stageGap: STAGE_GAP,
      nodeGap: NODE_GAP_Y
    }
  };
}
