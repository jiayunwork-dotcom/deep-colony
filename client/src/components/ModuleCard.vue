<template>
  <div :class="['module-card', { manageable: isManageable, damaged: isDamaged, critical: isCritical, emergency: isEmergency, understaffed: hasAlarm, 'emergency-critical': isEmergencyCritical }]">
    <div class="module-header">
      <span class="module-name">{{ module.name }}</span>
      <span v-if="isManageable" class="manage-badge">管理中</span>
    </div>

    <div class="module-durability">
      <div class="durability-label">
        <span>耐久度</span>
        <span>{{ module.durability.toFixed(0) }}%</span>
      </div>
      <div class="durability-bar">
        <div
          class="durability-fill"
          :class="durabilityClass"
          :style="{ width: module.durability + '%' }"
        ></div>
      </div>
    </div>

    <div class="module-stats">
      <div class="stat">
        <span class="stat-label">效率</span>
        <span class="stat-value">{{ (module.efficiency * 100).toFixed(0) }}%</span>
      </div>
      <div class="stat">
        <span class="stat-label">人员</span>
        <span class="stat-value" :class="{ 'alarm': hasAlarm }">
          <span v-if="hasAlarm" class="alarm-icon">⚠️</span>
          {{ module.crewAssigned.length }}/{{ module.crewRequired }}
        </span>
      </div>
    </div>

    <div v-if="isManageable" class="power-control">
      <span class="power-label">
        功耗等级
        <span v-if="isEmergency" class="emergency-note">（紧急状态，仅可调低）</span>
      </span>
      <div class="power-buttons">
        <button
          v-for="level in module.maxPowerLevel"
          :key="level"
          :class="['power-btn', { active: module.powerLevel === level, disabled: isPowerDisabled(level) }]"
          :disabled="isPowerDisabled(level)"
          @click="setPower(level)"
        >
          {{ level }}
        </button>
      </div>
    </div>
    <div v-else class="power-display">
      <span class="power-label">功耗等级</span>
      <span class="power-value">{{ module.powerLevel }} 级</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ShipModule, ModuleType } from '@deep-colony/shared';
import { EMERGENCY_DURABILITY_THRESHOLD } from '@deep-colony/shared';

const props = defineProps<{
  module: ShipModule;
  isManageable: boolean;
}>();

const emit = defineEmits<{
  powerChange: [moduleId: ModuleType, level: number];
}>();

const isDamaged = computed(() => props.module.durability < 50);
const isCritical = computed(() => props.module.durability < 30);
const isEmergency = computed(() => props.module.durability > 0 && props.module.durability < EMERGENCY_DURABILITY_THRESHOLD);
const hasAlarm = computed(() => props.module.shiftConfig?.hasAlarm ?? false);
const isEmergencyCritical = computed(() => props.module.shiftConfig?.mode === 'flexible' && props.module.shiftConfig?.emergencyLevel === 'critical');

const durabilityClass = computed(() => {
  if (props.module.durability < EMERGENCY_DURABILITY_THRESHOLD) return 'critical';
  if (props.module.durability < 30) return 'critical';
  if (props.module.durability < 60) return 'warning';
  return 'normal';
});

function isPowerDisabled(level: number): boolean {
  if (!props.isManageable) return true;
  if (isEmergency.value && level > props.module.powerLevel) {
    return true;
  }
  return false;
}

function setPower(level: number) {
  if (props.isManageable && !isPowerDisabled(level)) {
    emit('powerChange', props.module.id, level);
  }
}
</script>

<style scoped>
.module-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 14px;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.module-card.manageable {
  border-color: var(--accent-cyan);
  box-shadow: 0 0 10px rgba(0, 212, 255, 0.2);
}

.module-card.damaged {
  border-color: var(--accent-yellow);
}

.module-card.critical {
  border-color: var(--accent-red);
  animation: pulse-danger 2s infinite;
}

.module-card.emergency {
  border-color: var(--accent-red);
  border-width: 3px;
  animation: emergency-flash 0.8s infinite;
}

.module-card.understaffed {
  border-color: var(--accent-red);
  border-width: 2px;
  animation: understaffed-flash 1.2s infinite;
}

.module-card.emergency-critical {
  border-color: var(--accent-red);
  border-width: 3px;
  animation: emergency-critical-flash 0.8s infinite;
}

@keyframes emergency-critical-flash {
  0%, 100% {
    border-color: var(--accent-red);
    box-shadow: 0 0 12px rgba(255, 68, 102, 0.7), inset 0 0 8px rgba(255, 68, 102, 0.15);
  }
  50% {
    border-color: #ff6688;
    box-shadow: 0 0 28px rgba(255, 68, 102, 1), inset 0 0 15px rgba(255, 68, 102, 0.3);
  }
}

@keyframes understaffed-flash {
  0%, 100% {
    border-color: var(--accent-red);
    box-shadow: 0 0 8px rgba(255, 68, 102, 0.4);
  }
  50% {
    border-color: #ff6688;
    box-shadow: 0 0 20px rgba(255, 68, 102, 0.8), inset 0 0 10px rgba(255, 68, 102, 0.1);
  }
}

.stat-value.alarm {
  color: var(--accent-red);
  animation: alarm-pulse 1.2s ease-in-out infinite;
}
.alarm-icon {
  margin-right: 4px;
  display: inline-block;
  animation: alarm-shake 0.5s ease-in-out infinite;
}

@keyframes alarm-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes alarm-shake {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-10deg); }
  75% { transform: rotate(10deg); }
}

@keyframes pulse-danger {
  0%, 100% { box-shadow: 0 0 5px rgba(255, 68, 102, 0.3); }
  50% { box-shadow: 0 0 15px rgba(255, 68, 102, 0.6); }
}

@keyframes emergency-flash {
  0%, 100% {
    border-color: var(--accent-red);
    box-shadow: 0 0 10px rgba(255, 68, 102, 0.8), inset 0 0 10px rgba(255, 68, 102, 0.2);
  }
  50% {
    border-color: #ff6688;
    box-shadow: 0 0 25px rgba(255, 68, 102, 1), inset 0 0 20px rgba(255, 68, 102, 0.4);
  }
}

.module-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.module-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.manage-badge {
  padding: 2px 8px;
  background: rgba(0, 212, 255, 0.2);
  color: var(--accent-cyan);
  border-radius: 4px;
  font-size: 11px;
}

.module-durability {
  margin-bottom: 10px;
}

.durability-label {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.durability-bar {
  height: 6px;
  background: var(--bg-primary);
  border-radius: 3px;
  overflow: hidden;
}

.durability-fill {
  height: 100%;
  background: var(--accent-green);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.durability-fill.warning {
  background: var(--accent-yellow);
}

.durability-fill.critical {
  background: var(--accent-red);
}

.module-stats {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  padding: 8px;
  background: var(--bg-primary);
  border-radius: 6px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 11px;
  color: var(--text-muted);
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.power-control, .power-display {
  padding-top: 10px;
  border-top: 1px solid var(--border-color);
}

.power-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
  display: block;
}

.power-buttons {
  display: flex;
  gap: 4px;
}

.power-btn {
  flex: 1;
  padding: 6px 0;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 13px;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.power-btn:hover {
  border-color: var(--accent-blue);
  color: var(--text-primary);
}

.power-btn.active {
  background: var(--accent-blue);
  border-color: var(--accent-blue);
  color: white;
}

.power-btn.disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.power-btn.disabled:hover {
  border-color: var(--border-color);
  color: var(--text-secondary);
}

.emergency-note {
  color: var(--accent-red);
  font-size: 11px;
  margin-left: 8px;
}

.power-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--accent-yellow);
}
</style>
