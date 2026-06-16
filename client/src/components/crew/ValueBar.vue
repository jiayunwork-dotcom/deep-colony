<template>
  <div class="value-bar-wrapper">
    <div class="value-label">
      <span class="value-text">{{ Math.round(value) }}%</span>
    </div>
    <div class="value-bar">
      <div
        class="value-fill"
        :class="barClass"
        :style="{ width: percent + '%' }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  value: number;
  max?: number;
  colorScheme?: 'default' | 'fatigue';
}>(); 

const percent = computed(() => {
  const m = props.max ?? 100;
  return Math.max(0, Math.min(100, (props.value / m) * 100));
});

const barClass = computed(() => {
  const scheme = props.colorScheme || 'default';
  
  if (scheme === 'fatigue') {
    if (percent.value >= 80) return 'danger';
    if (percent.value >= 50) return 'warning';
    return 'good';
  }
  
  if (percent.value >= 70) return 'good';
  if (percent.value >= 40) return 'warning';
  return 'danger';
});
</script>

<style scoped>
.value-bar-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.value-label {
  display: flex;
  justify-content: flex-end;
}

.value-text {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.value-bar {
  width: 100%;
  height: 8px;
  background: var(--bg-primary);
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.value-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease, background-color 0.3s ease;
}

.value-fill.good {
  background: linear-gradient(90deg, var(--accent-green), #44ffaa);
  box-shadow: 0 0 6px rgba(0, 255, 136, 0.4);
}

.value-fill.warning {
  background: linear-gradient(90deg, var(--accent-yellow), #ffdd44);
  box-shadow: 0 0 6px rgba(255, 204, 0, 0.4);
}

.value-fill.danger {
  background: linear-gradient(90deg, var(--accent-red), #ff6677);
  box-shadow: 0 0 6px rgba(255, 68, 102, 0.5);
  animation: pulse-danger 1.5s ease-in-out infinite;
}

@keyframes pulse-danger {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
</style>
