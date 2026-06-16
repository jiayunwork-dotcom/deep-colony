<template>
  <span class="status-tag" :class="statusClass">
    <span class="status-dot"></span>
    <span class="status-text">{{ statusText }}</span>
    <span v-if="statusTurns > 0" class="status-turns">({{ statusTurns }}回合)</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Colonist } from '@deep-colony/shared';

const props = defineProps<{
  colonist: Colonist;
}>();

const statusClass = computed(() => {
  if (props.colonist.isCollapsed) return 'collapsed';
  if (props.colonist.isOverworked) return 'overworked';
  if (props.colonist.isFrozen) return 'frozen';
  if (props.colonist.isMutineer) return 'mutineer';
  if (props.colonist.isInfected) return 'infected';
  return 'normal';
});

const statusText = computed(() => {
  if (props.colonist.isCollapsed) return '倒下';
  if (props.colonist.isOverworked) return '过劳';
  if (props.colonist.isFrozen) return '冷冻中';
  if (props.colonist.isMutineer) return '叛变中';
  if (props.colonist.isInfected) return '感染中';
  return '正常';
});

const statusTurns = computed(() => {
  if (props.colonist.isMutineer) return props.colonist.mutinyTurnsLeft;
  if (props.colonist.isInfected) return props.colonist.infectionTurnsLeft;
  return 0;
});
</script>

<style scoped>
.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid transparent;
  white-space: nowrap;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.status-tag.normal {
  background: rgba(0, 255, 136, 0.1);
  border-color: rgba(0, 255, 136, 0.3);
  color: var(--accent-green);
}
.status-tag.normal .status-dot {
  background: var(--accent-green);
  box-shadow: 0 0 4px var(--accent-green);
}

.status-tag.infected {
  background: rgba(255, 68, 102, 0.1);
  border-color: rgba(255, 68, 102, 0.3);
  color: var(--accent-red);
  animation: pulse-bad 1.8s ease-in-out infinite;
}
.status-tag.infected .status-dot {
  background: var(--accent-red);
  box-shadow: 0 0 6px var(--accent-red);
  animation: blink 1.2s ease-in-out infinite;
}

.status-tag.mutineer {
  background: rgba(255, 204, 0, 0.1);
  border-color: rgba(255, 204, 0, 0.35);
  color: var(--accent-yellow);
}
.status-tag.mutineer .status-dot {
  background: var(--accent-yellow);
  box-shadow: 0 0 5px var(--accent-yellow);
}

.status-tag.frozen {
  background: rgba(0, 212, 255, 0.1);
  border-color: rgba(0, 212, 255, 0.35);
  color: var(--accent-cyan);
}
.status-tag.frozen .status-dot {
  background: var(--accent-cyan);
  box-shadow: 0 0 5px var(--accent-cyan);
}

.status-tag.overworked {
  background: rgba(255, 165, 0, 0.1);
  border-color: rgba(255, 165, 0, 0.4);
  color: var(--accent-orange);
  animation: pulse-overwork 2s ease-in-out infinite;
}
.status-tag.overworked .status-dot {
  background: var(--accent-orange);
  box-shadow: 0 0 6px var(--accent-orange);
  animation: blink 1s ease-in-out infinite;
}

.status-tag.collapsed {
  background: rgba(255, 68, 102, 0.15);
  border-color: rgba(255, 68, 102, 0.5);
  color: var(--accent-red);
  animation: pulse-collapse 1.2s ease-in-out infinite;
}
.status-tag.collapsed .status-dot {
  background: var(--accent-red);
  box-shadow: 0 0 8px var(--accent-red);
  animation: blink 0.6s ease-in-out infinite;
}

.status-turns {
  color: inherit;
  opacity: 0.85;
  font-variant-numeric: tabular-nums;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
@keyframes pulse-bad {
  0%, 100% { background: rgba(255, 68, 102, 0.1); }
  50% { background: rgba(255, 68, 102, 0.2); }
}
@keyframes pulse-overwork {
  0%, 100% { background: rgba(255, 165, 0, 0.1); }
  50% { background: rgba(255, 165, 0, 0.2); }
}
@keyframes pulse-collapse {
  0%, 100% { background: rgba(255, 68, 102, 0.15); transform: scale(1); }
  50% { background: rgba(255, 68, 102, 0.3); transform: scale(1.02); }
}
</style>
