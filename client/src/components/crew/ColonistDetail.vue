<template>
  <Transition name="modal">
    <div v-if="visible" class="modal-mask" @click.self="$emit('close')">
      <div class="modal-container">
        <header class="modal-header">
          <div class="title-block">
            <div class="big-avatar" :class="avatarClass">
              {{ colonist?.name.slice(0, 1) }}
            </div>
            <div class="title-text">
              <h2 class="colonist-name">
                {{ colonist?.name }}
                <span class="age-badge">{{ colonist?.age }}岁</span>
              </h2>
              <div class="colonist-meta">
                <StatusTag v-if="colonist" :colonist="colonist" />
              </div>
            </div>
          </div>
          <button class="close-btn" @click="$emit('close')">×</button>
        </header>

        <div v-if="colonist" class="modal-body">
          <section class="detail-section">
            <h3 class="section-title">📊 属性状态</h3>
            <div class="stat-grid">
              <div class="stat-box">
                <div class="stat-box-label">健康值</div>
                <ValueBar :value="colonist.health" :max="colonist.maxHealth" />
              </div>
              <div class="stat-box">
                <div class="stat-box-label">士气</div>
                <ValueBar :value="colonist.morale" />
              </div>
              <div class="stat-box">
                <div class="stat-box-label">年龄</div>
                <div class="stat-box-value">{{ colonist.age }} <span class="stat-unit">岁</span></div>
              </div>
            </div>

            <div class="status-duration" v-if="statusDurationText">
              <span class="sd-label">⏱ 状态持续时间:</span>
              <span class="sd-value">{{ statusDurationText }}</span>
            </div>

            <div class="work-info">
              <div class="wi-row">
                <span class="wi-label">当前工作模块:</span>
                <span class="wi-value">
                  <span v-if="colonist.assignedModule" class="module-chip">
                    {{ currentModuleName }}
                  </span>
                  <span v-else class="unassigned-chip">待命(未分配)</span>
                </span>
              </div>
              <div class="wi-row" v-if="colonist.assignedModule">
                <span class="wi-label">技能匹配度:</span>
                <span class="wi-value">
                  <span class="efficiency-value" :class="isGoodMatch ? 'good' : 'bad'">
                    {{ matchEfficiencyText }}
                  </span>
                  <span class="efficiency-note">
                    ({{ isGoodMatch ? `技能${matchSkillName}匹配` : '非技能岗位' }})
                  </span>
                </span>
              </div>

              <div class="assign-actions">
                <label class="wi-label">快捷分配:</label>
                <div class="assign-dropdown-wrapper">
                  <select
                    :value="colonist.assignedModule || ''"
                    class="assign-select"
                    @change="onAssignChange($event)"
                  >
                    <option value="">-- 取消分配(待命) --</option>
                    <optgroup label="你管理的模块">
                      <option
                        v-for="m in manageableModules"
                        :key="'my-' + m.id"
                        :value="m.id"
                      >
                        {{ m.name }} ({{ m.crewAssigned.length }}/{{ m.crewRequired }})
                      </option>
                    </optgroup>
                    <optgroup v-if="otherModules.length > 0" label="其他模块(无权限)">
                      <option
                        v-for="m in otherModules"
                        :key="'o-' + m.id"
                        :value="m.id"
                        disabled
                      >
                        🔒 {{ m.name }}
                      </option>
                    </optgroup>
                  </select>
                  <span v-if="hasAssignWarning" class="assign-warn">
                    仅可分配到你管理的模块
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section class="detail-section">
            <h3 class="section-title">📈 健康/士气历史变化 (最近20回合)</h3>
            <LineChart :data="colonist.statsHistory" :width="560" :height="180" />
          </section>

          <section class="detail-section">
            <h3 class="section-title">🎯 五项技能雷达图</h3>
            <div class="radar-wrap">
              <RadarChart :axes="skillAxes" :values="colonist.skills" :max="5" :size="260" />
              <div class="skills-list">
                <div v-for="s in skillAxes" :key="s.key" class="skill-row">
                  <span class="skill-label">{{ s.label }}</span>
                  <StarRating :value="colonist.skills[s.key]" :max="5" />
                  <span class="skill-numeric">Lv.{{ colonist.skills[s.key] }}</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type {
  Colonist,
  ModuleType,
  SkillType,
  ShipModule,
} from '@deep-colony/shared';
import {
  MODULE_NAMES,
  SKILL_NAMES,
  MODULE_SKILL_MATCH,
  SKILL_EFFICIENCY,
  NON_SKILL_EFFICIENCY,
} from '@deep-colony/shared';
import StatusTag from './StatusTag.vue';
import ValueBar from './ValueBar.vue';
import StarRating from './StarRating.vue';
import LineChart from './LineChart.vue';
import RadarChart from './RadarChart.vue';

const props = defineProps<{
  visible: boolean;
  colonist: Colonist | null;
  modules: ShipModule[];
  manageableModuleIds: ModuleType[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'assign', moduleId: ModuleType | null): void;
}>();

const skillAxes: { key: SkillType; label: string }[] = [
  { key: 'engineering', label: SKILL_NAMES.engineering },
  { key: 'medical', label: SKILL_NAMES.medical },
  { key: 'agriculture', label: SKILL_NAMES.agriculture },
  { key: 'science', label: SKILL_NAMES.science },
  { key: 'military', label: SKILL_NAMES.military },
];

const avatarClass = computed(() => {
  const c = props.colonist;
  if (!c) return 'normal';
  if (c.isFrozen) return 'frozen';
  if (c.isMutineer) return 'danger';
  if (c.isInfected) return 'warning';
  if (c.health <= 30) return 'danger';
  if (c.morale <= 30) return 'warning';
  return 'normal';
});

const statusDurationText = computed(() => {
  const c = props.colonist;
  if (!c) return '';
  if (c.isMutineer) return `叛变中，剩余 ${c.mutinyTurnsLeft} 回合`;
  if (c.isInfected) return `感染中，剩余 ${c.infectionTurnsLeft} 回合`;
  if (c.isFrozen) return `冷冻状态`;
  return '';
});

const currentModule = computed(() => {
  if (!props.colonist?.assignedModule) return null;
  return props.modules.find(m => m.id === props.colonist!.assignedModule) || null;
});
const currentModuleName = computed(() => {
  if (!props.colonist?.assignedModule) return '';
  return MODULE_NAMES[props.colonist.assignedModule];
});

const matchSkill = computed<SkillType | null>(() => {
  if (!props.colonist?.assignedModule) return null;
  return MODULE_SKILL_MATCH[props.colonist.assignedModule];
});
const matchSkillName = computed(() => matchSkill.value ? SKILL_NAMES[matchSkill.value] : '');

const isGoodMatch = computed(() => {
  if (!props.colonist || !matchSkill.value) return false;
  return props.colonist.skills[matchSkill.value] > 0;
});

const matchEfficiencyText = computed(() => {
  const c = props.colonist;
  if (!c || !matchSkill.value) return '';
  const lvl = c.skills[matchSkill.value];
  let eff = NON_SKILL_EFFICIENCY;
  if (lvl > 0) {
    eff = SKILL_EFFICIENCY[matchSkill.value] * (0.8 + lvl * 0.1);
  }
  return `×${eff.toFixed(2)}`;
});

const manageableModules = computed(() => {
  return props.modules.filter(m => props.manageableModuleIds.includes(m.id));
});
const otherModules = computed(() => {
  return props.modules.filter(m => !props.manageableModuleIds.includes(m.id));
});

const hasAssignWarning = computed(() => {
  if (!props.colonist) return false;
  if (!props.colonist.assignedModule) return false;
  return !props.manageableModuleIds.includes(props.colonist.assignedModule);
});

function onAssignChange(e: Event) {
  const sel = e.target as HTMLSelectElement;
  const val = sel.value as ModuleType | '';
  const target = val || null;
  if (target && !props.manageableModuleIds.includes(target)) return;
  emit('assign', target);
}
</script>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}

.modal-container {
  width: 100%;
  max-width: 680px;
  max-height: 90vh;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6), 0 0 40px rgba(0, 212, 255, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary));
  border-bottom: 1px solid var(--border-color);
}

.title-block {
  display: flex;
  align-items: center;
  gap: 14px;
}

.big-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}
.big-avatar.normal { background: linear-gradient(135deg, var(--accent-green), var(--accent-cyan)); }
.big-avatar.warning { background: linear-gradient(135deg, var(--accent-yellow), var(--accent-orange)); }
.big-avatar.danger { background: linear-gradient(135deg, var(--accent-red), #ff8899); }
.big-avatar.frozen { background: linear-gradient(135deg, var(--accent-blue), var(--accent-cyan)); }

.title-text { display: flex; flex-direction: column; gap: 6px; }
.colonist-name {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}
.colonist-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}
.close-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 22px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
}
.close-btn:hover {
  background: rgba(255, 68, 102, 0.1);
  color: var(--accent-red);
  border-color: rgba(255, 68, 102, 0.3);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 22px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-color);
  margin: 0;
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 14px;
}
.stat-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}
.stat-box-label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

.stat-box-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--accent-cyan);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}
.stat-unit {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
}

.age-badge {
  display: inline-block;
  padding: 2px 8px;
  background: rgba(0, 212, 255, 0.12);
  border: 1px solid rgba(0, 212, 255, 0.35);
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-cyan);
  margin-left: 8px;
  vertical-align: middle;
}

.status-duration {
  padding: 8px 12px;
  background: rgba(255, 204, 0, 0.08);
  border: 1px dashed rgba(255, 204, 0, 0.3);
  border-radius: 8px;
  font-size: 13px;
  display: flex;
  gap: 6px;
}
.sd-label { color: var(--text-secondary); }
.sd-value { color: var(--accent-yellow); font-weight: 600; }

.work-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}
.wi-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.wi-label {
  color: var(--text-muted);
  min-width: 84px;
  font-weight: 500;
  flex-shrink: 0;
}
.wi-value { flex: 1; color: var(--text-primary); }

.module-chip {
  display: inline-block;
  padding: 3px 10px;
  background: rgba(74, 158, 255, 0.15);
  border: 1px solid rgba(74, 158, 255, 0.4);
  color: var(--accent-blue);
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
}
.unassigned-chip {
  display: inline-block;
  padding: 3px 10px;
  background: rgba(92, 102, 128, 0.2);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  border-radius: 10px;
  font-size: 12px;
}

.efficiency-value { font-weight: 700; font-size: 14px; }
.efficiency-value.good { color: var(--accent-green); }
.efficiency-value.bad { color: var(--accent-orange); }
.efficiency-note {
  margin-left: 6px;
  color: var(--text-muted);
  font-size: 12px;
}

.assign-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.assign-dropdown-wrapper {
  flex: 1;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.assign-select {
  padding: 8px 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  cursor: pointer;
  transition: all 0.2s;
}
.assign-select:hover { border-color: var(--accent-cyan); }
.assign-select:focus {
  border-color: var(--accent-cyan);
  box-shadow: 0 0 0 2px rgba(0, 212, 255, 0.15);
}
.assign-warn {
  font-size: 11px;
  color: var(--accent-yellow);
}

.radar-wrap {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
  justify-content: center;
}
.skills-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
  min-width: 200px;
}
.skill-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.skill-label {
  min-width: 44px;
  color: var(--text-secondary);
  font-weight: 500;
}
.skill-numeric {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  margin-left: auto;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}
.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s;
}
.modal-enter-from,
.modal-leave-to { opacity: 0; }
.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: translateY(20px) scale(0.98);
  opacity: 0;
}
</style>
