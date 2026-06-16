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

    <div class="tech-tree">
      <div v-for="tier in [1, 2, 3]" :key="tier" class="tech-tier">
        <div class="tier-label">Tier {{ tier }}</div>
        <div class="tier-techs">
          <div
            v-for="tech in getTierTechs(tier)"
            :key="tech.id"
            :class="['tech-node', { researched: tech.researched, available: canResearch(tech), researching: currentTech?.id === tech.id }]"
            @click="handleTechClick(tech)"
          >
            <div class="tech-name">{{ tech.name }}</div>
            <div class="tech-cost">{{ tech.cost }} 点</div>
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
      <button
        v-if="canResearch(selectedTech) && !selectedTech.researched && isLabManager"
        class="btn-research"
        @click="startResearch(selectedTech.id)"
      >
        开始研究
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useGameStore } from '@/stores/game';
import { TECH_TREE, type TechNode, type PlayerAction } from '@deep-colony/shared';

const gameStore = useGameStore();

const selectedTech = ref<TechNode | null>(null);

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
}

function startResearch(techId: string) {
  if (!isLabManager.value) return;
  const action: PlayerAction = {
    type: 'startResearch',
    techId,
  };
  gameStore.sendAction(action);
}
</script>

<style scoped>
.tech-panel {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 14px;
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

.tech-tree {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tech-tier {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tier-label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
}

.tier-techs {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tech-node {
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.tech-node:hover {
  border-color: var(--accent-blue);
}

.tech-node.researched {
  background: rgba(0, 255, 136, 0.1);
  border-color: var(--accent-green);
}

.tech-node.available {
  border-color: var(--accent-purple);
  cursor: pointer;
}

.tech-node.researching {
  background: rgba(170, 102, 255, 0.2);
  border-color: var(--accent-purple);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 5px rgba(170, 102, 255, 0.3); }
  50% { box-shadow: 0 0 15px rgba(170, 102, 255, 0.6); }
}

.tech-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.tech-cost {
  font-size: 11px;
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
}

.tech-detail .prereq {
  margin-top: 6px;
  color: var(--text-muted);
  font-size: 11px;
}

.btn-research {
  width: 100%;
  margin-top: 10px;
  padding: 8px 16px;
  background: var(--accent-purple);
  color: white;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
}

.btn-research:hover {
  background: #9955ff;
}
</style>
