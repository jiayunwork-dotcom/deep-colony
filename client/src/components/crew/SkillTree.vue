<template>
  <div class="skill-tree-container">
    <div class="tree-tabs">
      <button
        v-for="module in SKILL_TREE_MODULES"
        :key="module"
        class="tree-tab"
        :class="{ active: activeModule === module }"
        :style="{ '--module-color': SKILL_TREE_MODULE_COLORS[module] }"
        @click="activeModule = module"
      >
        <span class="tab-icon">{{ getModuleIcon(module) }}</span>
        <span class="tab-name">{{ SKILL_TREE_MODULE_NAMES[module] }}</span>
        <span v-if="hasUnlockableNodes(module)" class="unlock-badge">!</span>
      </button>
    </div>

    <div v-if="activeTree" class="tree-display">
      <div class="tree-header">
        <h4 class="tree-title" :style="{ color: SKILL_TREE_MODULE_COLORS[activeModule] }">
          {{ SKILL_TREE_MODULE_NAMES[activeModule] }} 技能树
        </h4>
        <div class="tree-header-actions">
          <div class="tree-exp">
            <span class="exp-label">总经验: {{ activeTree.totalExp }}</span>
          </div>
          <button
            v-if="hasUnlockedNodesInActiveTree"
            class="btn-reset"
            @click="showResetConfirm = true"
          >
            🔄 重置
          </button>
        </div>
      </div>

      <div class="tree-visualization">
        <div class="tier master-tier">
          <div class="tier-label">精通</div>
          <div class="nodes-row">
            <div
              v-for="node in masterNodes"
              :key="node.id"
              class="skill-node"
              :class="getNodeClass(node)"
              :style="getNodeStyle(node)"
              @click="handleNodeClick(node)"
              @mouseenter="hoveredNode = node"
              @mouseleave="hoveredNode = null"
            >
              <div class="node-inner">
                <span class="node-tier">M</span>
              </div>
              <span v-if="canUnlockNode(node)" class="upgrade-corner">↑</span>
              <div v-if="hoveredNode?.id === node.id" class="node-tooltip">
                <div class="tooltip-header">
                  <span class="tooltip-name">{{ node.name }}</span>
                  <span class="tooltip-tier">{{ SKILL_NODE_TIER_NAMES[node.tier] }}</span>
                </div>
                <div class="tooltip-desc">{{ node.description }}</div>
                <div class="tooltip-effect">
                  <span class="effect-type">{{ SKILL_EFFECT_TYPE_NAMES[node.effect.type] }}:</span>
                  <span class="effect-value">+{{ node.effect.value }}%</span>
                </div>
                <div class="tooltip-exp">
                  <div class="exp-row">
                    <span>所需经验:</span>
                    <span>{{ node.requiredExp }}</span>
                  </div>
                  <div class="exp-row">
                    <span>当前进度:</span>
                    <span>{{ activeTree.totalExp }} / {{ node.requiredExp }}</span>
                  </div>
                  <div class="exp-bar">
                    <div
                      class="exp-fill"
                      :style="{ width: Math.min(100, (activeTree.totalExp / node.requiredExp) * 100) + '%' }"
                    ></div>
                  </div>
                </div>
                <div v-if="canUnlockNode(node)" class="tooltip-action">
                  点击解锁
                </div>
                <div v-else-if="node.unlocked" class="tooltip-unlocked">
                  ✓ 已解锁
                </div>
                <div v-else class="tooltip-locked">
                  {{ getLockedReason(node) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="tier-connector">
          <div class="connector-line"></div>
        </div>

        <div class="tier advanced-tier">
          <div class="tier-label">进阶</div>
          <div class="nodes-row">
            <div
              v-for="node in advancedNodes"
              :key="node.id"
              class="skill-node"
              :class="getNodeClass(node)"
              :style="getNodeStyle(node)"
              @click="handleNodeClick(node)"
              @mouseenter="hoveredNode = node"
              @mouseleave="hoveredNode = null"
            >
              <div class="node-inner">
                <span class="node-tier">A</span>
              </div>
              <span v-if="canUnlockNode(node)" class="upgrade-corner">↑</span>
              <span v-if="isNodeMutuallyExclusive(node)" class="mutex-tag">已被互斥</span>
              <div v-if="hoveredNode?.id === node.id" class="node-tooltip">
                <div class="tooltip-header">
                  <span class="tooltip-name">{{ node.name }}</span>
                  <span class="tooltip-tier">{{ SKILL_NODE_TIER_NAMES[node.tier] }}</span>
                </div>
                <div class="tooltip-desc">{{ node.description }}</div>
                <div class="tooltip-effect">
                  <span class="effect-type">{{ SKILL_EFFECT_TYPE_NAMES[node.effect.type] }}:</span>
                  <span class="effect-value">+{{ node.effect.value }}%</span>
                </div>
                <div class="tooltip-exp">
                  <div class="exp-row">
                    <span>所需经验:</span>
                    <span>{{ node.requiredExp }}</span>
                  </div>
                  <div class="exp-row">
                    <span>当前进度:</span>
                    <span>{{ activeTree.totalExp }} / {{ node.requiredExp }}</span>
                  </div>
                  <div class="exp-bar">
                    <div
                      class="exp-fill"
                      :style="{ width: Math.min(100, (activeTree.totalExp / node.requiredExp) * 100) + '%' }"
                    ></div>
                  </div>
                </div>
                <div v-if="canUnlockNode(node)" class="tooltip-action">
                  点击解锁
                </div>
                <div v-else-if="node.unlocked" class="tooltip-unlocked">
                  ✓ 已解锁
                </div>
                <div v-else class="tooltip-locked">
                  {{ getLockedReason(node) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="tier-connector">
          <div class="connector-line"></div>
          <div class="connector-line"></div>
        </div>

        <div class="tier basic-tier">
          <div class="tier-label">基础</div>
          <div class="nodes-row">
            <div
              v-for="node in basicNodes"
              :key="node.id"
              class="skill-node"
              :class="getNodeClass(node)"
              :style="getNodeStyle(node)"
              @click="handleNodeClick(node)"
              @mouseenter="hoveredNode = node"
              @mouseleave="hoveredNode = null"
            >
              <div class="node-inner">
                <span class="node-tier">B</span>
              </div>
              <span v-if="canUnlockNode(node)" class="upgrade-corner">↑</span>
              <div v-if="hoveredNode?.id === node.id" class="node-tooltip">
                <div class="tooltip-header">
                  <span class="tooltip-name">{{ node.name }}</span>
                  <span class="tooltip-tier">{{ SKILL_NODE_TIER_NAMES[node.tier] }}</span>
                </div>
                <div class="tooltip-desc">{{ node.description }}</div>
                <div class="tooltip-effect">
                  <span class="effect-type">{{ SKILL_EFFECT_TYPE_NAMES[node.effect.type] }}:</span>
                  <span class="effect-value">+{{ node.effect.value }}%</span>
                </div>
                <div class="tooltip-exp">
                  <div class="exp-row">
                    <span>所需经验:</span>
                    <span>{{ node.requiredExp }}</span>
                  </div>
                  <div class="exp-row">
                    <span>当前进度:</span>
                    <span>{{ activeTree.totalExp }} / {{ node.requiredExp }}</span>
                  </div>
                  <div class="exp-bar">
                    <div
                      class="exp-fill"
                      :style="{ width: Math.min(100, (activeTree.totalExp / node.requiredExp) * 100) + '%' }"
                    ></div>
                  </div>
                </div>
                <div v-if="canUnlockNode(node)" class="tooltip-action">
                  点击解锁
                </div>
                <div v-else-if="node.unlocked" class="tooltip-unlocked">
                  ✓ 已解锁
                </div>
                <div v-else class="tooltip-locked">
                  {{ getLockedReason(node) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Transition name="modal">
      <div v-if="showResetConfirm" class="modal-mask" @click.self="showResetConfirm = false">
        <div class="modal-container">
          <div class="modal-header">
            <h3 class="modal-title">确认重置技能树？</h3>
          </div>
          <div class="modal-body">
            <div class="reset-warning">
              <div class="warning-icon">⚠️</div>
              <div class="warning-content">
                <p>重置 <strong>{{ SKILL_TREE_MODULE_NAMES[activeModule] }}</strong> 技能树将：</p>
                <ul>
                  <li>清除该模块所有已解锁的技能节点</li>
                  <li class="penalty-item">
                    扣除 <strong>{{ resetPenalty }}</strong> 点经验值
                    <span class="penalty-detail">(当前: {{ activeTree?.totalExp || 0 }} × 30%)</span>
                  </li>
                  <li>剩余经验: <strong class="remaining-exp">{{ resetRemainingExp }}</strong> 点</li>
                  <li>技能效果将在下一回合结算时立即失效</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-cancel" @click="showResetConfirm = false">取消</button>
            <button class="btn btn-confirm" @click="handleConfirmReset">确认重置</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type {
  Colonist,
  SkillTreeModuleType,
  SkillNode,
} from '@deep-colony/shared';
import {
  SKILL_TREE_MODULES,
  SKILL_TREE_MODULE_NAMES,
  SKILL_TREE_MODULE_COLORS,
  SKILL_NODE_TIER_NAMES,
  SKILL_EFFECT_TYPE_NAMES,
  SKILL_RESET_PENALTY_RATE,
} from '@deep-colony/shared';

const props = defineProps<{
  colonist: Colonist;
}>();

const emit = defineEmits<{
  (e: 'unlock', module: SkillTreeModuleType, nodeId: string): void;
  (e: 'reset', module: SkillTreeModuleType): void;
}>();

const activeModule = ref<SkillTreeModuleType>('mainEngine');
const hoveredNode = ref<SkillNode | null>(null);
const showResetConfirm = ref(false);

const activeTree = computed(() => {
  return props.colonist.skillTree.trees[activeModule.value];
});

const basicNodes = computed(() => {
  if (!activeTree.value) return [];
  return Object.values(activeTree.value.nodes).filter(n => n.tier === 'basic');
});

const advancedNodes = computed(() => {
  if (!activeTree.value) return [];
  return Object.values(activeTree.value.nodes).filter(n => n.tier === 'advanced');
});

const masterNodes = computed(() => {
  if (!activeTree.value) return [];
  return Object.values(activeTree.value.nodes).filter(n => n.tier === 'master');
});

const hasUnlockedNodesInActiveTree = computed(() => {
  if (!activeTree.value) return false;
  return Object.values(activeTree.value.nodes).some(n => n.unlocked);
});

const resetPenalty = computed(() => {
  if (!activeTree.value) return 0;
  return Math.floor(activeTree.value.totalExp * SKILL_RESET_PENALTY_RATE);
});

const resetRemainingExp = computed(() => {
  if (!activeTree.value) return 0;
  return activeTree.value.totalExp - resetPenalty.value;
});

function getModuleIcon(module: SkillTreeModuleType): string {
  const icons: Record<SkillTreeModuleType, string> = {
    mainEngine: '🚀',
    medicalBay: '💊',
    laboratory: '🔬',
    farm: '🌾',
    defense: '🛡️',
    communication: '📡',
  };
  return icons[module];
}

function isNodeMutuallyExclusive(node: SkillNode): boolean {
  if (node.tier !== 'advanced' || node.unlocked) return false;
  if (!activeTree.value) return false;
  return advancedNodes.value.some(n => n.id !== node.id && n.unlocked);
}

function canUnlockNode(node: SkillNode): boolean {
  if (node.unlocked) return false;
  if (!activeTree.value) return false;
  if (activeTree.value.totalExp < node.requiredExp) return false;

  for (const prereqId of node.prerequisites) {
    const prereq = activeTree.value.nodes[prereqId];
    if (!prereq || !prereq.unlocked) return false;
  }

  if (node.tier === 'advanced') {
    const unlockedBasic = basicNodes.value.filter(n => n.unlocked).length;
    if (unlockedBasic < 2) return false;
    if (isNodeMutuallyExclusive(node)) return false;
  }

  if (node.tier === 'master') {
    const anyAdvancedUnlocked = advancedNodes.value.some(n => n.unlocked);
    if (!anyAdvancedUnlocked) return false;
  }

  return true;
}

function hasUnlockableNodes(module: SkillTreeModuleType): boolean {
  const tree = props.colonist.skillTree.trees[module];
  if (!tree) return false;
  const nodes = Object.values(tree.nodes);
  const basicNs = nodes.filter(n => n.tier === 'basic');
  const advancedNs = nodes.filter(n => n.tier === 'advanced');

  for (const n of nodes) {
    if (n.unlocked) continue;
    if (tree.totalExp < n.requiredExp) continue;

    let prereqsMet = true;
    for (const prereqId of n.prerequisites) {
      if (!tree.nodes[prereqId]?.unlocked) {
        prereqsMet = false;
        break;
      }
    }
    if (!prereqsMet) continue;

    if (n.tier === 'advanced') {
      const unlockedBasic = basicNs.filter(x => x.unlocked).length;
      if (unlockedBasic < 2) continue;
      const unlockedAdvanced = advancedNs.filter(x => x.unlocked).length;
      if (unlockedAdvanced >= 1) continue;
    }

    if (n.tier === 'master') {
      const anyAdvancedUnlocked = advancedNs.some(x => x.unlocked);
      if (!anyAdvancedUnlocked) continue;
    }

    return true;
  }
  return false;
}

function getNodeClass(node: SkillNode): Record<string, boolean> {
  const mutex = isNodeMutuallyExclusive(node);
  return {
    unlocked: node.unlocked,
    unlockable: canUnlockNode(node),
    locked: !node.unlocked && !canUnlockNode(node),
    'pulse-border': canUnlockNode(node),
    'mutex-locked': mutex,
  };
}

function getNodeStyle(node: SkillNode): Record<string, string> {
  const color = SKILL_TREE_MODULE_COLORS[activeModule.value];
  if (node.unlocked) {
    return {
      '--node-color': color,
      '--node-glow': color,
    };
  }
  if (canUnlockNode(node)) {
    return {
      '--node-color': color,
      '--node-border-color': color,
    };
  }
  if (isNodeMutuallyExclusive(node)) {
    return {
      '--node-color': '#444',
    };
  }
  return {
    '--node-color': '#555',
  };
}

function getLockedReason(node: SkillNode): string {
  if (!activeTree.value) return '数据加载中';
  if (activeTree.value.totalExp < node.requiredExp) {
    return `经验不足 (还需 ${node.requiredExp - activeTree.value.totalExp})`;
  }
  if (node.tier === 'advanced') {
    if (isNodeMutuallyExclusive(node)) {
      return '该进阶层已被互斥（只能解锁1个进阶节点）';
    }
    const unlockedBasic = basicNodes.value.filter(n => n.unlocked).length;
    if (unlockedBasic < 2) {
      return `需要至少解锁2个基础节点 (当前: ${unlockedBasic}/2)`;
    }
  }
  if (node.tier === 'master') {
    const anyAdvancedUnlocked = advancedNodes.value.some(n => n.unlocked);
    if (!anyAdvancedUnlocked) {
      return '需要至少解锁1个进阶节点';
    }
  }
  const lockedPrereqs = node.prerequisites.filter(
    id => !activeTree.value!.nodes[id]?.unlocked
  );
  if (lockedPrereqs.length > 0) {
    return '需要先解锁前置节点';
  }
  return '条件不足';
}

function handleNodeClick(node: SkillNode): void {
  if (canUnlockNode(node)) {
    emit('unlock', activeModule.value, node.id);
  }
}

async function handleConfirmReset(): Promise<void> {
  showResetConfirm.value = false;
  emit('reset', activeModule.value);
}
</script>

<style scoped>
.skill-tree-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 16px;
}

.tree-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tree-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  color: var(--text-secondary);
  font-size: 13px;
}

.tree-tab:hover {
  border-color: var(--module-color, var(--accent-cyan));
  color: var(--text-primary);
}

.tree-tab.active {
  background: color-mix(in srgb, var(--module-color, var(--accent-cyan)) 15%, transparent);
  border-color: var(--module-color, var(--accent-cyan));
  color: var(--module-color, var(--accent-cyan));
}

.tab-icon {
  font-size: 16px;
}

.tab-name {
  font-weight: 500;
}

.unlock-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  background: var(--accent-yellow);
  color: #000;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.tree-display {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tree-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
}

.tree-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.tree-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tree-exp {
  font-size: 12px;
  color: var(--text-muted);
}

.btn-reset {
  padding: 6px 12px;
  background: rgba(255, 68, 102, 0.15);
  border: 1px solid rgba(255, 68, 102, 0.4);
  color: var(--accent-red);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reset:hover {
  background: rgba(255, 68, 102, 0.25);
  border-color: var(--accent-red);
}

.tree-visualization {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 0;
  min-height: 320px;
}

.tier {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  position: relative;
}

.tier-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.nodes-row {
  display: flex;
  gap: 30px;
  justify-content: center;
  min-height: 60px;
  align-items: center;
}

.tier-connector {
  display: flex;
  gap: 40px;
  justify-content: center;
  height: 20px;
  position: relative;
}

.connector-line {
  width: 2px;
  height: 100%;
  background: var(--border-color);
  position: relative;
}

.connector-line::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 30px;
  height: 2px;
  background: var(--border-color);
}

.connector-line::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 30px;
  height: 2px;
  background: var(--border-color);
}

.skill-node {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: all 0.3s;
  background: var(--bg-secondary);
  border: 2px solid var(--node-color, #555);
}

.skill-node.unlocked {
  background: radial-gradient(circle, var(--node-color) 0%, color-mix(in srgb, var(--node-color) 50%, #000) 100%);
  box-shadow: 0 0 15px var(--node-glow, var(--node-color)), inset 0 0 10px rgba(255,255,255,0.2);
  border-color: var(--node-color);
}

.skill-node.unlockable {
  border: 2px dashed var(--node-border-color);
  animation: pulse-border 1.5s ease-in-out infinite;
}

.skill-node.locked {
  opacity: 0.5;
  cursor: not-allowed;
}

.skill-node.mutex-locked {
  opacity: 0.4;
  cursor: not-allowed;
  filter: grayscale(0.8);
}

.skill-node.unlockable:hover {
  transform: scale(1.1);
  box-shadow: 0 0 20px var(--node-border-color);
}

.skill-node.unlocked:hover {
  transform: scale(1.05);
}

@keyframes pulse-border {
  0%, 100% { border-color: var(--node-border-color); box-shadow: 0 0 0 0 rgba(0,0,0,0); }
  50% { border-color: color-mix(in srgb, var(--node-border-color) 60%, transparent); box-shadow: 0 0 15px var(--node-border-color); }
}

.node-inner {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.node-tier {
  font-size: 18px;
  font-weight: 700;
  color: white;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
}

.upgrade-corner {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 20px;
  height: 20px;
  background: var(--accent-yellow);
  color: #000;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  animation: bounce 1s ease-in-out infinite;
}

.mutex-tag {
  position: absolute;
  bottom: -16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 1px 6px;
  background: rgba(100, 100, 100, 0.9);
  color: #ccc;
  border-radius: 4px;
  font-size: 9px;
  white-space: nowrap;
  font-weight: 600;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

.node-tooltip {
  position: absolute;
  bottom: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%);
  width: 220px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  z-index: 100;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  pointer-events: none;
}

.node-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--border-color);
}

.tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.tooltip-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 13px;
}

.tooltip-tier {
  font-size: 10px;
  padding: 2px 6px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  color: var(--text-muted);
}

.tooltip-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  line-height: 1.4;
}

.tooltip-effect {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 4px 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  margin-bottom: 8px;
}

.effect-type {
  color: var(--text-muted);
}

.effect-value {
  color: var(--accent-green);
  font-weight: 600;
}

.tooltip-exp {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.exp-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-muted);
}

.exp-bar {
  height: 6px;
  background: var(--bg-tertiary);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 2px;
}

.exp-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-cyan), var(--accent-green));
  transition: width 0.3s;
}

.tooltip-action,
.tooltip-unlocked,
.tooltip-locked {
  margin-top: 8px;
  padding: 6px;
  border-radius: 4px;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
}

.tooltip-action {
  background: rgba(0, 212, 255, 0.15);
  color: var(--accent-cyan);
  border: 1px solid rgba(0, 212, 255, 0.4);
}

.tooltip-unlocked {
  background: rgba(76, 175, 80, 0.15);
  color: var(--accent-green);
  border: 1px solid rgba(76, 175, 80, 0.4);
}

.tooltip-locked {
  background: rgba(255, 68, 102, 0.1);
  color: var(--accent-red);
  border: 1px solid rgba(255, 68, 102, 0.3);
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal-container {
  width: 100%;
  max-width: 420px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6);
  overflow: hidden;
}

.modal-header {
  padding: 16px 20px;
  background: linear-gradient(135deg, rgba(255, 68, 102, 0.15), var(--bg-tertiary));
  border-bottom: 1px solid var(--border-color);
}

.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.modal-body {
  padding: 20px;
}

.reset-warning {
  display: flex;
  gap: 14px;
}

.warning-icon {
  font-size: 36px;
  flex-shrink: 0;
}

.warning-content p {
  margin: 0 0 10px 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.warning-content ul {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.8;
}

.warning-content strong {
  color: var(--text-primary);
}

.penalty-item strong {
  color: var(--accent-red);
}

.penalty-detail {
  color: var(--text-muted);
  font-size: 11px;
  margin-left: 4px;
}

.remaining-exp strong {
  color: var(--accent-green);
}

.modal-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 14px 20px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.btn-cancel {
  background: var(--bg-primary);
  border-color: var(--border-color);
  color: var(--text-secondary);
}

.btn-cancel:hover {
  color: var(--text-primary);
  border-color: var(--text-muted);
}

.btn-confirm {
  background: linear-gradient(135deg, var(--accent-red), #ff6b8a);
  color: white;
  border: none;
}

.btn-confirm:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(255, 68, 102, 0.4);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s;
}

.modal-enter-from,
.modal-leave-to { opacity: 0; }
.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: translateY(20px) scale(0.98);
  opacity: 0;
}
</style>
