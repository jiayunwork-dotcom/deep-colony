<template>
  <Transition name="slide-up">
    <div v-if="visible" class="batch-action-bar">
      <div class="bar-left">
        <span class="selected-info">
          已选择 <strong class="selected-count">{{ selectedCount }}</strong> 名殖民者
        </span>
        <span v-if="loading" class="loading-hint">
          <span class="spinner"></span>
          处理中...
        </span>
        <span v-else-if="lastResult" class="result-summary" :class="resultClass">
          <template v-if="lastResult.successCount > 0">
            ✅ {{ lastResult.successCount }} 人操作成功
          </template>
          <template v-if="lastResult.failureCount > 0">
            ❌ {{ lastResult.failureCount }} 人失败
            <span class="failure-reasons">
              ({{ formatFailureReasons(lastResult) }})
            </span>
          </template>
        </span>
      </div>

      <div class="bar-right">
        <div class="assign-dropdown">
          <button
            class="btn btn-primary"
            :disabled="loading || manageableModules.length === 0"
            @click="manageableModules.length > 0 && (isDropdownOpen = !isDropdownOpen)"
          >
            📥 批量分配到...
            <span v-if="manageableModules.length > 0" class="arrow">{{ isDropdownOpen ? '▲' : '▼' }}</span>
          </button>
          <div v-if="isDropdownOpen && manageableModules.length > 0" class="dropdown-menu">
            <div class="dropdown-header">选择目标模块（仅显示你管理的模块）</div>
            <button
              v-for="m in manageableModules"
              :key="m.id"
              class="dropdown-item"
              :disabled="loading"
              @click="handleBatchAssign(m.id)"
            >
              <span class="mod-icon">🔧</span>
              <span class="mod-name">{{ m.name }}</span>
              <span class="mod-count">{{ m.crewAssigned.length }}/{{ m.crewRequired }}</span>
            </button>
          </div>
        </div>
        <span v-if="manageableModules.length === 0" class="no-modules-hint" title="当前玩家未管理任何模块，无法分配">
          🔒
        </span>
        <button
          class="btn btn-warn"
          :disabled="loading"
          @click="handleBatchUnassign"
        >
          📤 批量取消分配
        </button>
        <button
          class="btn btn-ghost"
          :disabled="loading"
          @click="$emit('clearSelection')"
        >
          取消选择
        </button>
      </div>

      <div v-if="isDropdownOpen" class="dropdown-mask" @click="isDropdownOpen = false"></div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { ShipModule, ModuleType, BatchActionResult } from '@deep-colony/shared';

const props = defineProps<{
  visible: boolean;
  selectedCount: number;
  manageableModules: ShipModule[];
  loading: boolean;
  lastResult: BatchActionResult | null;
}>();

const emit = defineEmits<{
  (e: 'batchAssign', moduleId: ModuleType): void;
  (e: 'batchUnassign'): void;
  (e: 'clearSelection'): void;
}>();

const isDropdownOpen = ref(false);

watch(() => props.visible, (v) => {
  if (!v) isDropdownOpen.value = false;
});

const resultClass = computed(() => {
  if (!props.lastResult) return '';
  if (props.lastResult.failureCount === 0) return 'all-good';
  if (props.lastResult.successCount === 0) return 'all-bad';
  return 'partial';
});

function formatFailureReasons(r: BatchActionResult): string {
  const reasonCounts: Record<string, number> = {};
  for (const f of r.failures) {
    reasonCounts[f.reason] = (reasonCounts[f.reason] || 0) + 1;
  }
  return Object.entries(reasonCounts)
    .map(([k, v]) => `${v}人${k}`)
    .join('、');
}

function handleBatchAssign(moduleId: ModuleType) {
  isDropdownOpen.value = false;
  emit('batchAssign', moduleId);
}
function handleBatchUnassign() {
  emit('batchUnassign');
}
</script>

<style scoped>
.batch-action-bar {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 18px;
  background: var(--bg-tertiary);
  border: 1px solid var(--accent-cyan);
  border-radius: 14px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 212, 255, 0.15);
  min-width: 720px;
  max-width: 92vw;
}

.bar-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.selected-info {
  font-size: 13px;
  color: var(--text-secondary);
}

.selected-count {
  color: var(--accent-cyan);
  font-size: 18px;
  font-weight: 700;
  padding: 0 2px;
}

.loading-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--accent-blue);
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(74, 158, 255, 0.3);
  border-top-color: var(--accent-blue);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.result-summary {
  padding: 5px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
}
.result-summary.all-good {
  background: rgba(0, 255, 136, 0.12);
  color: var(--accent-green);
  border: 1px solid rgba(0, 255, 136, 0.35);
}
.result-summary.partial {
  background: rgba(255, 204, 0, 0.1);
  color: var(--accent-yellow);
  border: 1px solid rgba(255, 204, 0, 0.35);
}
.result-summary.all-bad {
  background: rgba(255, 68, 102, 0.1);
  color: var(--accent-red);
  border: 1px solid rgba(255, 68, 102, 0.35);
}

.failure-reasons {
  opacity: 0.85;
  margin-left: 4px;
}

.bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.btn {
  padding: 9px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, var(--accent-green), var(--accent-cyan));
  color: #001a15;
}
.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(0, 255, 136, 0.3);
}

.btn-warn {
  background: linear-gradient(135deg, var(--accent-orange), var(--accent-yellow));
  color: #1a1300;
}
.btn-warn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(255, 136, 0, 0.3);
}

.btn-ghost {
  background: var(--bg-primary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}
.btn-ghost:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--accent-blue);
}

.arrow {
  font-size: 10px;
  margin-left: 2px;
  opacity: 0.8;
}

.assign-dropdown {
  position: relative;
}

.dropdown-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 10px);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 6px;
  min-width: 240px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
  z-index: 100;
}

.dropdown-header {
  padding: 6px 10px 8px;
  font-size: 11px;
  color: var(--text-muted);
  border-bottom: 1px dashed var(--border-color);
  margin-bottom: 4px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 7px;
  font-size: 13px;
  color: var(--text-primary);
  text-align: left;
  transition: all 0.15s;
}
.dropdown-item:hover:not(:disabled) {
  background: rgba(0, 212, 255, 0.12);
  color: var(--accent-cyan);
}
.dropdown-item:disabled {
  opacity: 0.5;
}

.mod-name { flex: 1; font-weight: 500; }
.mod-count {
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  padding: 2px 7px;
  background: var(--bg-primary);
  border-radius: 10px;
}

.dropdown-empty {
  padding: 12px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}

.no-modules-hint {
  font-size: 14px;
  color: var(--text-muted);
  cursor: help;
  opacity: 0.7;
}

.dropdown-mask {
  position: fixed;
  inset: 0;
  z-index: -1;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translate(-50%, 30px);
}
</style>
