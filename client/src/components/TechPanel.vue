<template>
  <div class="tech-panel">
    <h3>科技研发</h3>
    
    <div class="tech-points">
      <span class="points-label">科技点</span>
      <span class="points-value">{{ techPoints.toFixed(0) }}</span>
    </div>

    <div v-if="currentTech" class="current-research">
      <div class="research-header">
        <span>研究中</span>
        <span>{{ currentTech.name }}</span>
      </div>
      <div class="research-progress">
        <div
          class="progress-fill"
          :style="{ width: researchProgress * 100 + '%' }"
        ></div>
      </div>
      <div class="research-info">
        <span>{{ techPoints.toFixed(0) }} / {{ currentTech.cost }}</span>
      </div>
    </div>

    <div class="tech-tree-container">
      <svg class="tech-connections" :viewBox="`0 0 ${svgWidth} ${svgHeight}`">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#5c6680" />
          </marker>
          <marker id="arrowhead-active" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#4a9eff" />
          </marker>
          <marker id="arrowhead-researched" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#00ff88" />
          </marker>
        </defs>
        <line
          v-for="conn in connections"
          :key="`${conn.from}-${conn.to}`"
          :x1="conn.x1"
          :y1="conn.y1"
          :x2="conn.x2"
          :y2="conn.y2"
          :class="['connection-line', conn.class]"
          :marker-end="conn.marker"
        />
      </svg>

      <div class="tech-tree">
        <div v-for="tier in [1, 2, 3]" :key="tier" class="tech-tier">
          <div class="tier-label">Tier {{ tier }}</div>
          <div class="tier-techs">
            <div
              v-for="tech in getTierTechs(tier)"
              :key="tech.id"
              :ref="el => setTechRef(tech.id, el)"
              :class="[
                'tech-node',
                {
                  researched: tech.researched,
                  available: canResearch(tech),
                  researching: currentTech?.id === tech.id,
                  locked: !canResearch(tech) && !tech.researched
                }
              ]"
              :style="getNodeStyle(tech)"
              @click="handleTechClick(tech)"
            >
              <div class="tech-node-inner">
                <div class="tech-name">{{ tech.name }}</div>
                <div class="tech-cost">{{ tech.cost }} 点</div>
                <div v-if="tech.researched" class="tech-status">✓ 已研究</div>
                <div v-else-if="canResearch(tech)" class="tech-status available">可研究</div>
                <div v-else class="tech-status locked">需要前置</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedTech" class="tech-detail">
      <h4>{{ selectedTech.name }}</h4>
      <p>{{ selectedTech.description }}</p>
      <p class="prereq" v-if="selectedTech.prerequisites.length > 0">
        前置: {{ selectedTech.prerequisites.map(p => techTree[p]?.name).join(', ') }}
      </p>
      <p class="effect" v-if="selectedTech.effect">
        效果: {{ getEffectDescription(selectedTech.effect) }}
      </p>
    </div>

    <div v-if="showConfirmDialog" class="confirm-overlay" @click="cancelResearch">
      <div class="confirm-dialog" @click.stop>
        <h4>确认研究</h4>
        <p>确定要开始研究 <strong>{{ confirmTech?.name }}</strong> 吗？</p>
        <p class="cost-info">消耗科技点: <strong>{{ confirmTech?.cost }}</strong></p>
        <p class="current-points">当前科技点: {{ techPoints.toFixed(0) }}</p>
        <div class="confirm-buttons">
          <button class="btn-cancel" @click="cancelResearch">取消</button>
          <button class="btn-confirm" @click="confirmResearch">确认研究</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useGameStore } from '@/stores/game';
import { TECH_TREE, type TechNode, type PlayerAction, type TechEffect } from '@deep-colony/shared';

const gameStore = useGameStore();

const selectedTech = ref<TechNode | null>(null);
const showConfirmDialog = ref(false);
const confirmTech = ref<TechNode | null>(null);
const techRefs = ref<Record<string, HTMLElement | null>>({});
const nodePositions = ref<Record<string, { x: number; y: number; width: number; height: number }>>({});
const svgWidth = ref(500);
const svgHeight = ref(600);

const NODE_WIDTH = 160;
const NODE_HEIGHT = 70;
const TIER_GAP = 120;
const NODE_GAP = 16;

const gameState = computed(() => gameStore.gameState);
const techTree = computed(() => gameState.value?.techTree || TECH_TREE);
const techPoints = computed(() => gameState.value?.techPoints || 0);
const currentTechId = computed(() => gameState.value?.currentTech);

const currentTech = computed(() => {
  if (!currentTechId.value) return null;
  return techTree.value[currentTechId.value] || null;
});

const researchProgress = computed(() => {
  if (!currentTech.value) return 0;
  return Math.min(1, techPoints.value / currentTech.value.cost);
});

const isLabManager = computed(() => {
  return gameStore.currentPlayer?.assignedModules.includes('laboratory') || false;
});

function setTechRef(id: string, el: any) {
  techRefs.value[id] = el;
}

function getNodeStyle(tech: TechNode) {
  const pos = nodePositions.value[tech.id];
  if (!pos) return {};
  return {
    position: 'absolute' as const,
    left: pos.x + 'px',
    top: pos.y + 'px',
    width: NODE_WIDTH + 'px',
    height: NODE_HEIGHT + 'px',
  };
}

function calculateNodePositions() {
  const allTechs = Object.values(techTree.value);
  const tiers = [1, 2, 3];
  let maxWidth = 0;

  tiers.forEach((tier, tierIndex) => {
    const tierTechs = allTechs.filter(t => t.tier === tier);
    const totalWidth = tierTechs.length * NODE_WIDTH + (tierTechs.length - 1) * NODE_GAP;
    maxWidth = Math.max(maxWidth, totalWidth);

    const startX = 0;
    const y = tierIndex * (NODE_HEIGHT + TIER_GAP) + 30;

    tierTechs.forEach((tech, techIndex) => {
      const x = startX + techIndex * (NODE_WIDTH + NODE_GAP);
      nodePositions.value[tech.id] = {
        x,
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      };
    });
  });

  svgWidth.value = maxWidth;
  svgHeight.value = tiers.length * (NODE_HEIGHT + TIER_GAP) + 50;
}

const connections = computed(() => {
  const conns: { from: string; to: string; x1: number; y1: number; x2: number; y2: number; class: string; marker: string }[] = [];

  Object.values(techTree.value).forEach(tech => {
    tech.prerequisites.forEach(prereqId => {
      const fromPos = nodePositions.value[prereqId];
      const toPos = nodePositions.value[tech.id];
      if (fromPos && toPos) {
        const x1 = fromPos.x + fromPos.width / 2;
        const y1 = fromPos.y + fromPos.height;
        const x2 = toPos.x + toPos.width / 2;
        const y2 = toPos.y;

        let lineClass = 'connection-locked';
        let marker = 'url(#arrowhead)';

        if (techTree.value[prereqId]?.researched && tech.researched) {
          lineClass = 'connection-researched';
          marker = 'url(#arrowhead-researched)';
        } else if (techTree.value[prereqId]?.researched && canResearch(tech)) {
          lineClass = 'connection-available';
          marker = 'url(#arrowhead-active)';
        } else if (techTree.value[prereqId]?.researched) {
          lineClass = 'connection-active';
          marker = 'url(#arrowhead-active)';
        }

        conns.push({
          from: prereqId,
          to: tech.id,
          x1,
          y1,
          x2,
          y2,
          class: lineClass,
          marker,
        });
      }
    });
  });

  return conns;
});

function getTierTechs(tier: number): TechNode[] {
  return Object.values(techTree.value).filter(t => t.tier === tier);
}

function canResearch(tech: TechNode): boolean {
  if (tech.researched) return false;
  if (currentTech.value) return false;
  for (const prereq of tech.prerequisites) {
    if (!techTree.value[prereq]?.researched) return false;
  }
  return true;
}

function handleTechClick(tech: TechNode) {
  selectedTech.value = tech;

  if (canResearch(tech) && isLabManager.value) {
    confirmTech.value = tech;
    showConfirmDialog.value = true;
  }
}

function cancelResearch() {
  showConfirmDialog.value = false;
  confirmTech.value = null;
}

function confirmResearch() {
  if (confirmTech.value) {
    startResearch(confirmTech.value.id);
  }
  cancelResearch();
}

function startResearch(techId: string) {
  if (!isLabManager.value) return;
  const action: PlayerAction = {
    type: 'startResearch',
    techId,
  };
  gameStore.sendAction(action);
}

function getEffectDescription(effect: TechEffect): string {
  const effectNames: Record<TechEffect['type'], string> = {
    powerBonus: '发电量提升',
    farmBonus: '农场产出提升',
    autoRepair: '每回合自动修复耐久',
    cryoChambers: '可冻结人口减少消耗',
    shieldUpgrade: '陨石伤害减免',
    engineEfficiency: '引擎效率提升',
    warpDrive: '航行速度翻倍',
    oxygenBonus: '氧气产出提升',
    factoryEfficiency: '工厂效率提升',
    waterRecoveryBonus: '水回收率提升',
    medicalEfficiency: '医疗效率提升',
    moraleBonus: '全员士气提升',
    defenseEfficiency: '防御拦截效果提升',
    metalRegeneration: '每回合自动再生金属',
    wasteRecycling: '废物转化为食物',
  };

  const name = effectNames[effect.type] || effect.type;
  if (effect.type === 'autoRepair' || effect.type === 'moraleBonus' || effect.type === 'metalRegeneration') {
    return `${name} +${effect.value}`;
  }
  return `${name} +${(effect.value * 100).toFixed(0)}%`;
}

function updatePositions() {
  nextTick(() => {
    calculateNodePositions();
  });
}

watch(techTree, () => {
  updatePositions();
}, { deep: true });

onMounted(() => {
  updatePositions();
});
</script>

<style scoped>
.tech-panel {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 14px;
  position: relative;
}

.tech-panel h3 {
  font-size: 16px;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.tech-points {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  margin-bottom: 14px;
}

.points-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.points-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--accent-purple);
}

.current-research {
  padding: 12px;
  background: rgba(170, 102, 255, 0.1);
  border: 1px solid var(--accent-purple);
  border-radius: 8px;
  margin-bottom: 14px;
}

.research-header {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 8px;
}

.research-header span:first-child {
  color: var(--text-secondary);
}

.research-header span:last-child {
  color: var(--accent-purple);
  font-weight: 600;
}

.research-progress {
  height: 6px;
  background: var(--bg-primary);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 6px;
}

.progress-fill {
  height: 100%;
  background: var(--accent-purple);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.research-info {
  font-size: 12px;
  color: var(--text-muted);
  text-align: right;
}

.tech-tree-container {
  position: relative;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 10px;
}

.tech-connections {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.connection-line {
  stroke-width: 2;
  fill: none;
}

.connection-locked {
  stroke: #3a4460;
  stroke-dasharray: 4, 4;
}

.connection-active {
  stroke: var(--accent-blue);
}

.connection-available {
  stroke: var(--accent-blue);
  stroke-width: 3;
}

.connection-researched {
  stroke: var(--accent-green);
  stroke-width: 3;
}

.tech-tree {
  position: relative;
  min-height: 400px;
}

.tech-tier {
  position: relative;
  margin-bottom: 120px;
  min-height: 70px;
}

.tier-label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  margin-bottom: 10px;
}

.tier-techs {
  position: relative;
  min-height: 70px;
}

.tech-node {
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 2;
}

.tech-node:hover:not(.locked) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.tech-node.locked {
  opacity: 0.5;
  cursor: not-allowed;
  background: #1a1f30;
  border-color: #2a3048;
}

.tech-node.locked:hover {
  transform: none;
  box-shadow: none;
}

.tech-node.researched {
  background: rgba(0, 255, 136, 0.15);
  border-color: var(--accent-green);
  box-shadow: 0 0 15px rgba(0, 255, 136, 0.2);
}

.tech-node.available {
  border-color: var(--accent-blue);
  border-width: 2px;
  box-shadow: 0 0 10px rgba(74, 158, 255, 0.3);
  animation: available-pulse 2s infinite;
}

@keyframes available-pulse {
  0%, 100% { box-shadow: 0 0 10px rgba(74, 158, 255, 0.3); }
  50% { box-shadow: 0 0 20px rgba(74, 158, 255, 0.6); }
}

.tech-node.researching {
  background: rgba(170, 102, 255, 0.2);
  border-color: var(--accent-purple);
  animation: research-pulse 2s infinite;
}

@keyframes research-pulse {
  0%, 100% { box-shadow: 0 0 5px rgba(170, 102, 255, 0.3); }
  50% { box-shadow: 0 0 15px rgba(170, 102, 255, 0.6); }
}

.tech-node-inner {
  display: flex;
  flex-direction: column;
  gap: 4px;
  height: 100%;
}

.tech-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.tech-cost {
  font-size: 11px;
  color: var(--accent-purple);
  font-weight: 500;
}

.tech-status {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: auto;
}

.tech-status.available {
  color: var(--accent-blue);
}

.tech-status.locked {
  color: var(--text-muted);
}

.tech-detail {
  margin-top: 14px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 8px;
}

.tech-detail h4 {
  font-size: 14px;
  margin-bottom: 6px;
  color: var(--text-primary);
}

.tech-detail p {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 4px;
}

.tech-detail .prereq {
  margin-top: 6px;
  color: var(--text-muted);
  font-size: 11px;
}

.tech-detail .effect {
  color: var(--accent-green);
  font-size: 11px;
}

.confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.confirm-dialog {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.confirm-dialog h4 {
  font-size: 18px;
  margin-bottom: 16px;
  color: var(--text-primary);
}

.confirm-dialog p {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  line-height: 1.6;
}

.confirm-dialog strong {
  color: var(--accent-purple);
}

.confirm-dialog .cost-info {
  color: var(--accent-yellow);
}

.confirm-dialog .current-points {
  color: var(--text-muted);
  font-size: 13px;
  margin-bottom: 20px;
}

.confirm-buttons {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn-cancel, .btn-confirm {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-cancel {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.btn-cancel:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.btn-confirm {
  background: var(--accent-purple);
  color: white;
}

.btn-confirm:hover {
  background: #9955ff;
  transform: translateY(-1px);
}
</style>
