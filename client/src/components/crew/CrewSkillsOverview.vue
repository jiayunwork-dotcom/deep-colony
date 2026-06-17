<template>
  <div class="crew-skills-overview">
    <div class="panel-header">
      <h3 class="panel-title">
        <span class="title-icon">🎯</span>
        船员技能总览
      </h3>
      <div class="total-points">
        <span class="points-label">技能点总数</span>
        <span class="points-value">{{ totalSkillPoints }}</span>
      </div>
    </div>

    <div class="progress-section">
      <div class="progress-title">各模块解锁率</div>
      <div class="progress-grid">
        <div
          v-for="module in SKILL_TREE_MODULES"
          :key="module"
          class="progress-item"
        >
          <div
            class="animated-ring"
            :style="{ width: '64px', height: '64px' }"
          >
            <svg
              width="64"
              height="64"
              viewBox="0 0 64 64"
              style="transform: rotate(-90deg)"
            >
              <circle
                cx="32"
                cy="32"
                :r="ringRadius"
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                stroke-width="6"
              />
              <circle
                cx="32"
                cy="32"
                :r="ringRadius"
                fill="none"
                :stroke="SKILL_TREE_MODULE_COLORS[module]"
                stroke-width="6"
                stroke-linecap="round"
                :stroke-dasharray="circumference"
                :stroke-dashoffset="getRingOffset(module)"
                :style="{
                  transition: `stroke-dashoffset ${300}ms cubic-bezier(0.33, 1, 0.68, 1)`,
                  filter: `drop-shadow(0 0 4px ${SKILL_TREE_MODULE_COLORS[module]}80)`
                }"
              />
            </svg>
            <span
              class="ring-percent"
              :style="{ color: SKILL_TREE_MODULE_COLORS[module] }"
            >
              {{ displayPercentages[module] || 0 }}%
            </span>
          </div>
          <span
            class="module-label"
            :style="{ color: SKILL_TREE_MODULE_COLORS[module] }"
          >
            {{ SKILL_TREE_MODULE_NAMES[module] }}
          </span>
        </div>
      </div>
    </div>

    <div class="timeline-section">
      <div class="timeline-title">最近技能事件</div>
      <div class="timeline-list">
        <div
          v-for="(event, idx) in recentSkillEvents"
          :key="idx"
          class="timeline-item"
        >
          <div class="timeline-dot" :class="event.type"></div>
          <div class="timeline-content">
            <span class="timeline-message">{{ event.message }}</span>
            <span class="timeline-turn">第{{ event.turn }}回合</span>
          </div>
        </div>
        <div v-if="recentSkillEvents.length === 0" class="no-events">
          暂无技能事件记录
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch, onMounted } from 'vue';
import type { GameState, SkillTreeModuleType } from '@deep-colony/shared';
import {
  SKILL_TREE_MODULES,
  SKILL_TREE_MODULE_NAMES,
  SKILL_TREE_MODULE_COLORS,
  SKILL_TREE_DEFINITIONS,
} from '@deep-colony/shared';

const props = defineProps<{
  gameState: GameState;
}>();

const ringRadius = (64 - 6) / 2;
const circumference = 2 * Math.PI * ringRadius;

interface SkillEvent {
  turn: number;
  message: string;
  type: 'unlock' | 'reset';
}

const displayPercentages = reactive<Record<string, number>>({});

const totalSkillPoints = computed(() => {
  let total = 0;
  for (const colonist of Object.values(props.gameState.colonists)) {
    if (colonist.health <= 0) continue;
    for (const module of SKILL_TREE_MODULES) {
      const tree = colonist.skillTree.trees[module];
      if (!tree) continue;
      for (const node of Object.values(tree.nodes)) {
        if (node.unlocked) total++;
      }
    }
  }
  return total;
});

function getModuleUnlockRate(module: SkillTreeModuleType): number {
  const totalNodesPerColonist = SKILL_TREE_DEFINITIONS[module].length;
  const livingColonists = Object.values(props.gameState.colonists).filter(c => c.health > 0);
  if (livingColonists.length === 0) return 0;

  const totalPossible = totalNodesPerColonist * livingColonists.length;
  let totalUnlocked = 0;

  for (const colonist of livingColonists) {
    const tree = colonist.skillTree.trees[module];
    if (!tree) continue;
    for (const node of Object.values(tree.nodes)) {
      if (node.unlocked) totalUnlocked++;
    }
  }

  return Math.round((totalUnlocked / totalPossible) * 100);
}

function getRingOffset(module: SkillTreeModuleType): number {
  const percent = displayPercentages[module] || 0;
  return circumference - (percent / 100) * circumference;
}

const recentSkillEvents = computed<SkillEvent[]>(() => {
  const events: SkillEvent[] = [];
  const logs = props.gameState.gameLog;

  for (let i = logs.length - 1; i >= 0 && events.length < 5; i--) {
    const log = logs[i];
    if (!log) continue;

    if (log.message.includes('🔄') && log.message.includes('重置了') && log.message.includes('技能树')) {
      events.push({
        turn: log.turn,
        message: log.message.replace('🔄 ', ''),
        type: 'reset',
      });
    } else if (log.message.includes('🌟') && log.message.includes('解锁了')) {
      events.push({
        turn: log.turn,
        message: log.message.replace('🌟 ', ''),
        type: 'unlock',
      });
    }
  }

  return events;
});

watch(
  () => SKILL_TREE_MODULES.map(m => getModuleUnlockRate(m)),
  (newRates) => {
    SKILL_TREE_MODULES.forEach((m, i) => {
      displayPercentages[m] = newRates[i];
    });
  },
  { immediate: true }
);

onMounted(() => {
  SKILL_TREE_MODULES.forEach(m => {
    displayPercentages[m] = getModuleUnlockRate(m);
  });
});
</script>

<style scoped>
.crew-skills-overview {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.panel-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.title-icon {
  font-size: 16px;
}

.total-points {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.points-label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

.points-value {
  font-size: 22px;
  font-weight: 800;
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-green));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-variant-numeric: tabular-nums;
}

.progress-section,
.timeline-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.progress-title,
.timeline-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.progress-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px 8px;
}

.progress-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.animated-ring {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ring-percent {
  position: absolute;
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.module-label {
  font-size: 11px;
  font-weight: 600;
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 160px;
  overflow-y: auto;
}

.timeline-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  font-size: 11px;
}

.timeline-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
}

.timeline-dot.unlock {
  background: var(--accent-green);
  box-shadow: 0 0 6px var(--accent-green);
}

.timeline-dot.reset {
  background: var(--accent-orange, #ff9800);
  box-shadow: 0 0 6px var(--accent-orange, #ff9800);
}

.timeline-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.timeline-message {
  color: var(--text-secondary);
  line-height: 1.4;
  word-break: break-all;
}

.timeline-turn {
  font-size: 10px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.no-events {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  padding: 16px;
  background: var(--bg-tertiary);
  border-radius: 6px;
}
</style>
