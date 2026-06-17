<template>
  <div
    class="module-slot-card"
    :class="{
      manageable: isManageable,
      'drag-over': dragState.isOver,
      'drag-over-valid': dragState.isOver && dragState.canDrop,
      'drag-over-invalid': dragState.isOver && !dragState.canDrop,
      'understaffed': module.crewAssigned.length < module.crewRequired,
      'full': module.crewAssigned.length >= module.crewRequired,
    }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div class="slot-header">
      <div class="slot-title">
        <span v-if="isManageable" class="managed-dot" title="你管理此模块">🔑</span>
        <span class="slot-name">{{ module.name }}</span>
      </div>
      <div class="crew-count" :class="crewCountClass">
        {{ module.crewAssigned.length }}/{{ module.crewRequired }}
      </div>
    </div>

    <div class="shift-config" v-if="isManageable">
      <select
        class="shift-mode-select"
        :value="shiftConfig.mode"
        @change="onShiftModeChange"
      >
        <option value="continuous">连续工作</option>
        <option value="threeShift">三班倒</option>
        <option value="flexible">弹性排班</option>
      </select>
    </div>

    <div class="shift-info" v-if="shiftConfig.mode !== 'continuous'">
      <span class="current-shift" :class="'shift-' + shiftConfig.currentShift">
        当前:{{ shiftConfig.currentShift }}班在岗
      </span>
      <span v-if="shiftConfig.mode === 'threeShift'" class="next-shift-countdown">
        换班: {{ shiftConfig.turnsUntilNextShift }}回合
      </span>
      <span v-if="shiftConfig.emergencyLevel === 'critical'" class="emergency-badge">
        ⚠️ 紧急
      </span>
    </div>

    <div class="slot-match-info" v-if="matchSkillName">
      <span class="match-label">匹配技能:</span>
      <span class="match-skill">{{ matchSkillName }}</span>
    </div>

    <div v-if="shiftConfig.mode === 'threeShift'" class="three-shift-container">
      <div
        v-for="group in ['A', 'B', 'C'] as const"
        :key="group"
        class="shift-group"
        :class="{
          'active': shiftConfig.currentShift === group,
          'drag-over': shiftDragState[group]?.isOver,
          'drag-over-valid': shiftDragState[group]?.isOver && shiftDragState[group]?.canDrop,
        }"
        @dragover="(e) => onShiftDragOver(e, group)"
        @dragleave="(e) => onShiftDragLeave(e, group)"
        @drop="(e) => onShiftDrop(e, group)"
      >
        <div class="shift-group-header" :class="'shift-' + group">
          <span class="shift-group-name">{{ group }}班</span>
          <span v-if="shiftConfig.currentShift === group" class="shift-on-duty">● 在岗</span>
          <span v-else class="shift-resting">○ 休息</span>
        </div>
        <div class="shift-crew-list" :class="{ 'is-empty': getGroupCrew(group).length === 0 }">
          <div
            v-for="c in getGroupCrew(group)"
            :key="c.id"
            class="crew-chip"
            :class="{
              infected: c.isInfected,
              mutineer: c.isMutineer,
              frozen: c.isFrozen,
              overworked: c.isOverworked,
              collapsed: c.isCollapsed,
            }"
            draggable="true"
            @dragstart="onCrewDragStart($event, c)"
            @dragend="onCrewDragEnd"
            :title="`${c.name} - 疲劳:${getFatigueValue(c)}%`"
          >
            <div class="chip-avatar">
              {{ c.name.slice(0, 1) }}
            </div>
            <span class="chip-name">{{ c.name.slice(0, 4) }}</span>
            <span class="chip-fatigue" :class="getFatigueClass(c)">
              {{ getFatigueValue(c) }}
            </span>
          </div>
          <div v-if="getGroupCrew(group).length === 0" class="empty-hint">
            拖入分配
          </div>
        </div>
      </div>
    </div>

    <div v-else class="slot-crew-list" :class="{ 'is-empty': assignedCrew.length === 0 }">
      <div
        v-for="c in assignedCrew"
        :key="c.id"
        class="crew-chip"
        :class="{
          infected: c.isInfected,
          mutineer: c.isMutineer,
          frozen: c.isFrozen,
          overworked: c.isOverworked,
          collapsed: c.isCollapsed,
        }"
        draggable="true"
        @dragstart="onCrewDragStart($event, c)"
        @dragend="onCrewDragEnd"
        :title="`${c.name} - 疲劳:${getFatigueValue(c)}%`"
      >
        <div class="chip-avatar">
          {{ c.name.slice(0, 1) }}
        </div>
        <span class="chip-name">{{ c.name.slice(0, 4) }}</span>
        <span class="chip-fatigue" :class="getFatigueClass(c)">
          {{ getFatigueValue(c) }}
        </span>
        <span class="chip-efficiency" :class="getEfficiencyClass(c)">
          {{ formatEfficiencyShort(c) }}
        </span>
      </div>
      <div v-if="assignedCrew.length === 0" class="empty-hint">
        拖入殖民者进行分配
      </div>
    </div>

    <transition name="fade">
      <div
        v-if="dragState.isOver && hoveredColonist"
        class="slot-match-preview"
        :class="{ good: dragState.canDrop, bad: !dragState.canDrop || !hasPermission }"
      >
        <template v-if="!hasPermission">
          <span class="preview-icon">🔒</span>
          <span class="preview-text">无权限操作该模块</span>
        </template>
        <template v-else-if="!isColonistEligible(hoveredColonist)">
          <span class="preview-icon">⚠️</span>
          <span class="preview-text">
            无法分配：{{ getIneligibilityReason(hoveredColonist) }}
          </span>
        </template>
        <template v-else>
          <span class="preview-icon">{{ isGoodMatch(hoveredColonist) ? '✅' : '⚠️' }}</span>
          <span class="preview-match">{{ matchSkillName }}
            <span class="preview-efficiency" :class="isGoodMatch(hoveredColonist) ? 'good' : 'bad'">
              {{ formatMatchEfficiency(hoveredColonist) }}
            </span>
          </span>
          <span class="preview-text">
            {{ isGoodMatch(hoveredColonist) ? '技能匹配良好' : '非技能岗位，效率偏低' }}
          </span>
        </template>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue';
import type { ShipModule, Colonist, SkillType, ModuleType, ShiftMode, ShiftGroup, ModuleShiftConfig } from '@deep-colony/shared';
import {
  MODULE_SKILL_MATCH,
  MODULE_NAMES,
  SKILL_NAMES,
  SKILL_EFFICIENCY,
  NON_SKILL_EFFICIENCY,
} from '@deep-colony/shared';

const DEFAULT_SHIFT_CONFIG: ModuleShiftConfig = {
  mode: 'continuous',
  currentShift: 'A',
  turnsUntilNextShift: 3,
  assignments: [],
  emergencyLevel: 'normal',
  hasAlarm: false,
};

const props = defineProps<{
  module: ShipModule;
  colonists: Record<string, Colonist>;
  isManageable: boolean;
  hoveredColonist: Colonist | null;
}>();

const emit = defineEmits<{
  (e: 'assign', colonist: Colonist): void;
  (e: 'crewDragStart', colonist: Colonist, event: DragEvent): void;
  (e: 'crewDragEnd', event: DragEvent): void;
  (e: 'dragOverChange', isOver: boolean): void;
  (e: 'changeShiftMode', moduleId: string, mode: ShiftMode): void;
  (e: 'reassignShiftGroup', moduleId: string, colonistId: string, group: ShiftGroup): void;
}>();

const dragState = reactive({
  isOver: false,
  canDrop: false,
});

type ShiftDragState = Record<ShiftGroup, { isOver: boolean; canDrop: boolean }>;

const shiftDragState = reactive<ShiftDragState>({
  A: { isOver: false, canDrop: false },
  B: { isOver: false, canDrop: false },
  C: { isOver: false, canDrop: false },
});

const hasPermission = computed(() => props.isManageable);

const matchSkill = computed<SkillType>(() => MODULE_SKILL_MATCH[props.module.id]);
const matchSkillName = computed(() => SKILL_NAMES[matchSkill.value]);

const assignedCrew = computed<Colonist[]>(() => {
  return props.module.crewAssigned
    .map(id => props.colonists[id])
    .filter(Boolean) as Colonist[];
});

const crewCountClass = computed(() => {
  const ratio = props.module.crewAssigned.length / Math.max(1, props.module.crewRequired);
  if (ratio >= 1) return 'full';
  if (ratio >= 0.5) return 'partial';
  return 'low';
});

const shiftConfig = computed<ModuleShiftConfig>(() => {
  return props.module.shiftConfig || DEFAULT_SHIFT_CONFIG;
});

function getGroupCrew(group: ShiftGroup): Colonist[] {
  const assignments = shiftConfig.value.assignments || [];
  const colonistIds = assignments
    .filter(a => a.group === group)
    .map(a => a.colonistId);
  return colonistIds
    .map(id => props.colonists[id])
    .filter(Boolean) as Colonist[];
}

function getSkillEfficiency(c: Colonist): number {
  const skillLvl = c.skills[matchSkill.value];
  if (skillLvl > 0) {
    return SKILL_EFFICIENCY[matchSkill.value] * (0.8 + skillLvl * 0.1);
  }
  return NON_SKILL_EFFICIENCY;
}

function isGoodMatch(c: Colonist): boolean {
  return c.skills[matchSkill.value] > 0;
}

function formatMatchEfficiency(c: Colonist): string {
  const e = getSkillEfficiency(c);
  return `x${e.toFixed(2)}`;
}

function formatEfficiencyShort(c: Colonist): string {
  const e = getSkillEfficiency(c);
  return `×${e.toFixed(1)}`;
}

function getEfficiencyClass(c: Colonist): string {
  return isGoodMatch(c) ? 'good' : 'bad';
}

function getFatigueClass(c: Colonist): string {
  const f = c.fatigue ?? 0;
  if (f >= 80) return 'danger';
  if (f >= 50) return 'warning';
  return 'good';
}

function getFatigueValue(c: Colonist): number {
  return c.fatigue ?? 0;
}

function isColonistEligible(c: Colonist): boolean {
  if (c.health <= 0) return false;
  if (c.isMutineer) return false;
  if (c.isFrozen) return false;
  if (c.isCollapsed) return false;
  return true;
}

function getIneligibilityReason(c: Colonist): string {
  if (c.health <= 0) return '已死亡';
  if (c.isMutineer) return '叛变中';
  if (c.isFrozen) return '冷冻中';
  if (c.isCollapsed) return '已倒下';
  return '无法分配';
}

function onShiftModeChange(e: Event) {
  if (!props.isManageable) return;
  const select = e.target as HTMLSelectElement;
  const mode = select.value as ShiftMode;
  emit('changeShiftMode', props.module.id, mode);
}

function onShiftDragOver(e: DragEvent, group: ShiftGroup) {
  if (!e.dataTransfer) return;
  e.preventDefault();
  shiftDragState[group].isOver = true;
  shiftDragState[group].canDrop = !!(props.hoveredColonist && props.isManageable && isColonistEligible(props.hoveredColonist));
  e.dataTransfer.dropEffect = shiftDragState[group].canDrop ? 'move' : 'none';
}

function onShiftDragLeave(e: DragEvent, group: ShiftGroup) {
  const target = e.currentTarget as HTMLElement;
  const toEl = e.relatedTarget as HTMLElement | null;
  if (toEl && target.contains(toEl)) return;
  shiftDragState[group].isOver = false;
  shiftDragState[group].canDrop = false;
}

function onShiftDrop(e: DragEvent, group: ShiftGroup) {
  if (!e.dataTransfer) return;
  e.preventDefault();
  shiftDragState[group].isOver = false;
  shiftDragState[group].canDrop = false;
  if (!props.isManageable) return;
  if (!props.hoveredColonist) return;
  if (!isColonistEligible(props.hoveredColonist)) return;
  
  if (props.hoveredColonist.assignedModule === props.module.id) {
    emit('reassignShiftGroup', props.module.id, props.hoveredColonist.id, group);
  } else {
    emit('assign', props.hoveredColonist);
  }
}

function onDragOver(e: DragEvent) {
  if (!e.dataTransfer) return;
  e.preventDefault();
  dragState.isOver = true;
  dragState.canDrop = !!(props.hoveredColonist && props.isManageable && isColonistEligible(props.hoveredColonist));
  e.dataTransfer.dropEffect = dragState.canDrop ? 'move' : 'none';
  emit('dragOverChange', true);
}

function onDragLeave(e: DragEvent) {
  const target = e.currentTarget as HTMLElement;
  const toEl = e.relatedTarget as HTMLElement | null;
  if (toEl && target.contains(toEl)) return;
  dragState.isOver = false;
  dragState.canDrop = false;
  emit('dragOverChange', false);
}

function onDrop(e: DragEvent) {
  if (!e.dataTransfer) return;
  e.preventDefault();
  dragState.isOver = false;
  dragState.canDrop = false;
  emit('dragOverChange', false);
  if (!props.isManageable) return;
  if (!props.hoveredColonist) return;
  if (!isColonistEligible(props.hoveredColonist)) return;
  emit('assign', props.hoveredColonist);
}

function onCrewDragStart(e: DragEvent, c: Colonist) {
  emit('crewDragStart', c, e);
}
function onCrewDragEnd(e: DragEvent) {
  emit('crewDragEnd', e);
}
</script>

<style scoped>
.module-slot-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: 10px;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
  min-height: 160px;
}

.module-slot-card.manageable {
  border-color: rgba(0, 212, 255, 0.4);
  box-shadow: 0 0 10px rgba(0, 212, 255, 0.08);
}

.module-slot-card.understaffed {
  border-color: rgba(255, 204, 0, 0.3);
}

.module-slot-card.drag-over {
  transform: translateY(-1px);
}
.module-slot-card.drag-over-valid {
  border-color: var(--accent-green);
  box-shadow: 0 0 0 2px rgba(0, 255, 136, 0.25), 0 0 18px rgba(0, 255, 136, 0.25);
  background: rgba(0, 255, 136, 0.06);
}
.module-slot-card.drag-over-invalid {
  border-color: var(--accent-red);
  box-shadow: 0 0 0 2px rgba(255, 68, 102, 0.25), 0 0 18px rgba(255, 68, 102, 0.2);
  background: rgba(255, 68, 102, 0.05);
}

.slot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.slot-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: var(--text-primary);
  font-size: 14px;
}

.managed-dot {
  font-size: 13px;
  filter: drop-shadow(0 0 3px rgba(0, 212, 255, 0.6));
}

.slot-name {
  line-height: 1;
}

.crew-count {
  padding: 3px 9px;
  background: var(--bg-primary);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  border: 1px solid var(--border-color);
}
.crew-count.low { color: var(--accent-red); border-color: rgba(255, 68, 102, 0.4); }
.crew-count.partial { color: var(--accent-yellow); border-color: rgba(255, 204, 0, 0.4); }
.crew-count.full { color: var(--accent-green); border-color: rgba(0, 255, 136, 0.4); }

.slot-match-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-secondary);
  padding: 4px 8px;
  background: rgba(74, 158, 255, 0.08);
  border-radius: 6px;
  border: 1px dashed rgba(74, 158, 255, 0.25);
}
.match-label {
  color: var(--text-muted);
}
.match-skill {
  color: var(--accent-blue);
  font-weight: 600;
}

.slot-crew-list {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-content: flex-start;
  padding: 6px;
  background: var(--bg-primary);
  border-radius: 6px;
  border: 1px dashed rgba(42, 54, 84, 0.8);
  min-height: 64px;
}
.slot-crew-list.is-empty {
  justify-content: center;
  align-items: center;
}
.empty-hint {
  color: var(--text-muted);
  font-size: 11px;
  text-align: center;
  opacity: 0.7;
}

.crew-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px 3px 3px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  font-size: 11px;
  cursor: grab;
  transition: all 0.15s;
  user-select: none;
}
.crew-chip:hover {
  border-color: var(--accent-cyan);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 212, 255, 0.2);
}
.crew-chip:active { cursor: grabbing; }

.crew-chip.infected {
  border-color: rgba(255, 68, 102, 0.5);
  background: rgba(255, 68, 102, 0.08);
}
.crew-chip.mutineer {
  border-color: rgba(255, 204, 0, 0.5);
  background: rgba(255, 204, 0, 0.08);
}
.crew-chip.frozen {
  border-color: rgba(0, 212, 255, 0.5);
  background: rgba(0, 212, 255, 0.08);
}

.chip-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-blue));
  color: white;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chip-name {
  color: var(--text-primary);
  font-weight: 500;
  max-width: 44px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chip-efficiency {
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.chip-efficiency.good { color: var(--accent-green); }
.chip-efficiency.bad { color: var(--accent-orange); }

.slot-match-preview {
  position: absolute;
  inset: auto 8px 8px 8px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  z-index: 5;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
}
.slot-match-preview.good {
  border-color: rgba(0, 255, 136, 0.5);
  background: rgba(0, 255, 136, 0.08);
}
.slot-match-preview.bad {
  border-color: rgba(255, 68, 102, 0.5);
  background: rgba(255, 68, 102, 0.08);
}
.preview-icon {
  font-size: 14px;
}
.preview-match {
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
.preview-efficiency {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.preview-efficiency.good { color: var(--accent-green); }
.preview-efficiency.bad { color: var(--accent-red); }
.preview-text {
  font-size: 11px;
  color: var(--text-secondary);
}

.chip-fatigue {
  font-size: 9px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  padding: 1px 4px;
  border-radius: 4px;
  min-width: 20px;
  text-align: center;
}
.chip-fatigue.good { background: rgba(0, 255, 136, 0.15); color: var(--accent-green); }
.chip-fatigue.warning { background: rgba(255, 204, 0, 0.15); color: var(--accent-yellow); }
.chip-fatigue.danger { background: rgba(255, 68, 102, 0.2); color: var(--accent-red); }

.crew-chip.overworked {
  border-color: rgba(255, 165, 0, 0.5);
  background: rgba(255, 165, 0, 0.08);
}
.crew-chip.collapsed {
  border-color: rgba(255, 68, 102, 0.6);
  background: rgba(255, 68, 102, 0.15);
  opacity: 0.6;
}

.shift-config {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.shift-mode-select {
  flex: 1;
  padding: 6px 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.shift-mode-select:hover {
  border-color: var(--accent-cyan);
}
.shift-mode-select:focus {
  outline: none;
  border-color: var(--accent-blue);
}

.shift-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 6px 10px;
  background: var(--bg-primary);
  border-radius: 6px;
  border: 1px solid var(--border-color);
  margin-bottom: 8px;
  font-size: 11px;
}
.current-shift {
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}
.current-shift.shift-A { background: rgba(74, 158, 255, 0.2); color: var(--accent-blue); }
.current-shift.shift-B { background: rgba(0, 255, 136, 0.2); color: var(--accent-green); }
.current-shift.shift-C { background: rgba(255, 165, 0, 0.2); color: var(--accent-orange); }
.next-shift-countdown {
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
.emergency-badge {
  background: rgba(255, 68, 102, 0.15);
  color: var(--accent-red);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  animation: pulse-emergency 1.2s ease-in-out infinite;
}
@keyframes pulse-emergency {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.three-shift-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}
.shift-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  background: var(--bg-primary);
  border-radius: 6px;
  border: 1px solid var(--border-color);
  transition: all 0.2s;
  min-height: 60px;
}
.shift-group.active {
  border-color: var(--accent-cyan);
  background: rgba(0, 212, 255, 0.05);
}
.shift-group.drag-over {
  border-style: dashed;
  border-width: 2px;
}
.shift-group.drag-over-valid {
  border-color: var(--accent-green);
  background: rgba(0, 255, 136, 0.08);
}
.shift-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 4px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
}
.shift-group-header.shift-A { background: rgba(74, 158, 255, 0.1); color: var(--accent-blue); }
.shift-group-header.shift-B { background: rgba(0, 255, 136, 0.1); color: var(--accent-green); }
.shift-group-header.shift-C { background: rgba(255, 165, 0, 0.1); color: var(--accent-orange); }
.shift-group-name {
  font-weight: 700;
}
.shift-on-duty {
  color: var(--accent-green);
  font-size: 10px;
}
.shift-resting {
  color: var(--text-muted);
  font-size: 10px;
}
.shift-crew-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-content: flex-start;
  min-height: 40px;
}
.shift-crew-list.is-empty {
  justify-content: center;
  align-items: center;
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
