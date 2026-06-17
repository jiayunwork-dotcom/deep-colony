<template>
  <div class="colonist-list">
    <div class="stats-summary">
      <div class="stat-card">
        <div class="stat-icon">👥</div>
        <div class="stat-content">
          <div class="stat-label">总人口</div>
          <div class="stat-value">{{ stats.total }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">❤️</div>
        <div class="stat-content">
          <div class="stat-label">健康均值</div>
          <div class="stat-value" :class="avgHealthClass">{{ stats.avgHealth }}%</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue">😊</div>
        <div class="stat-content">
          <div class="stat-label">士气均值</div>
          <div class="stat-value" :class="avgMoraleClass">{{ stats.avgMorale }}%</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon normal">✅</div>
        <div class="stat-content">
          <div class="stat-label">正常</div>
          <div class="stat-value normal">{{ stats.statusCounts.normal }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon danger">☣️</div>
        <div class="stat-content">
          <div class="stat-label">感染</div>
          <div class="stat-value danger">{{ stats.statusCounts.infected }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon warning">⚔️</div>
        <div class="stat-content">
          <div class="stat-label">叛变</div>
          <div class="stat-value warning">{{ stats.statusCounts.mutineer }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon frozen">❄️</div>
        <div class="stat-content">
          <div class="stat-label">冷冻</div>
          <div class="stat-value frozen">{{ stats.statusCounts.frozen }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon warning">😰</div>
        <div class="stat-content">
          <div class="stat-label">过劳</div>
          <div class="stat-value warning">{{ stats.statusCounts.overworked }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon danger">💀</div>
        <div class="stat-content">
          <div class="stat-label">倒下</div>
          <div class="stat-value danger">{{ stats.statusCounts.collapsed }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon normal">⚡</div>
        <div class="stat-content">
          <div class="stat-label">疲劳均值</div>
          <div class="stat-value" :class="avgFatigueClass">{{ stats.avgFatigue }}%</div>
        </div>
      </div>
    </div>

    <div class="filter-bar">
      <div class="filter-group">
        <label>状态筛选:</label>
        <select v-model="filters.status" class="filter-select">
          <option value="">全部</option>
          <option value="normal">正常</option>
          <option value="infected">感染中</option>
          <option value="mutineer">叛变中</option>
          <option value="frozen">冷冻中</option>
        </select>
      </div>
      <div class="filter-group">
        <label>模块筛选:</label>
        <select v-model="filters.module" class="filter-select">
          <option value="">全部模块</option>
          <option value="__unassigned">待命(未分配)</option>
          <option v-for="m in modules" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
      </div>
      <div class="filter-group">
        <label>搜索姓名:</label>
        <input v-model="filters.search" type="text" class="filter-input" placeholder="输入姓名搜索..." />
      </div>
      <div class="filter-group search-info">
        显示 {{ filteredColonists.length }} / {{ colonists.length }} 人
      </div>
    </div>

    <div class="table-wrapper">
      <table class="colonist-table">
        <thead>
          <tr>
            <th class="col-checkbox" @click.stop @mousedown.stop @dragstart.stop>
              <input
                type="checkbox"
                :checked="isAllSelected"
                :indeterminate="isPartiallySelected"
                @click.stop
                @change="toggleSelectAll"
              />
            </th>
            <th class="col-drag"></th>
            <th
              v-for="col in columns"
              :key="col.key"
              :class="['col-' + col.key, { sortable: col.sortable }]"
              @click="col.sortable && setSort(col.key)"
            >
              <span class="col-header">
                {{ col.label }}
                <span v-if="col.sortable && sortKey === col.key" class="sort-icon">
                  {{ sortOrder === 'asc' ? '▲' : '▼' }}
                </span>
                <span v-else-if="col.sortable" class="sort-icon muted">⇅</span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in sortedColonists"
            :key="c.id"
            class="colonist-row"
            :class="{
              selected: selectedIds.has(c.id),
              infected: c.isInfected,
              mutineer: c.isMutineer,
              frozen: c.isFrozen,
              overworked: c.isOverworked,
              collapsed: c.isCollapsed,
              'has-hover': true
            }"
            draggable="true"
            @dragstart="onDragStart($event, c)"
            @dragend="onDragEnd($event)"
            @click="onRowClick($event, c)"
          >
            <td class="col-checkbox" @click.stop @mousedown.stop @dragstart.stop>
              <input
                type="checkbox"
                :checked="selectedIds.has(c.id)"
                @click.stop
                @change="toggleSelect(c.id)"
              />
            </td>
            <td class="col-drag">
              <span class="drag-handle" title="拖拽分配">⋮⋮</span>
            </td>
            <td class="col-name">
              <div class="avatar" :class="getColonistAvatarClass(c)">
                {{ c.name.slice(0, 1) }}
              </div>
              <span class="name-text">{{ c.name }}</span>
            </td>
            <td class="col-health">
              <ValueBar :value="c.health" :max="c.maxHealth" />
            </td>
            <td class="col-morale">
              <ValueBar :value="c.morale" />
            </td>
            <td class="col-fatigue">
              <ValueBar :value="c.fatigue ?? 0" :max="100" :color-scheme="'fatigue'" />
            </td>
            <td class="col-age">{{ c.age }}</td>
            <td v-for="s in skills" :key="'skill-' + s.key" class="col-skill">
              <StarRating :value="c.skills[s.key]" :max="5" />
            </td>
            <td class="col-module">
              <span v-if="c.assignedModule" class="module-badge">
                {{ getModuleName(c.assignedModule) }}
              </span>
              <span v-else class="unassigned-badge">待命</span>
            </td>
            <td class="col-status">
              <StatusTag :colonist="c" />
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="sortedColonists.length === 0" class="empty-state">
        没有符合条件的殖民者
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import type { Colonist, ModuleType, SkillType, ShipModule } from '@deep-colony/shared';
import { MODULE_NAMES, SKILL_NAMES } from '@deep-colony/shared';
import ValueBar from './ValueBar.vue';
import StarRating from './StarRating.vue';
import StatusTag from './StatusTag.vue';

const props = defineProps<{
  colonists: Colonist[];
  modules: ShipModule[];
  selectedIds: Set<string>;
}>();

const emit = defineEmits<{
  (e: 'update:selectedIds', val: Set<string>): void;
  (e: 'openDetail', colonist: Colonist): void;
  (e: 'dragStart', colonist: Colonist, event: DragEvent): void;
  (e: 'dragEnd', event: DragEvent): void;
}>();

const columns = [
  { key: 'name', label: '姓名', sortable: true, width: 110 },
  { key: 'health', label: '健康', sortable: true, width: 100 },
  { key: 'morale', label: '士气', sortable: true, width: 100 },
  { key: 'fatigue', label: '疲劳', sortable: true, width: 100 },
  { key: 'age', label: '年龄', sortable: true, width: 60 },
  { key: 'engineering', label: '工程', sortable: true, width: 70 },
  { key: 'medical', label: '医学', sortable: true, width: 70 },
  { key: 'agriculture', label: '农业', sortable: true, width: 70 },
  { key: 'science', label: '科研', sortable: true, width: 70 },
  { key: 'military', label: '军事', sortable: true, width: 70 },
  { key: 'assignedModule', label: '分配模块', sortable: true, width: 100 },
  { key: 'status', label: '状态', sortable: true, width: 90 },
];

const skills: { key: SkillType; label: string }[] = [
  { key: 'engineering', label: SKILL_NAMES.engineering },
  { key: 'medical', label: SKILL_NAMES.medical },
  { key: 'agriculture', label: SKILL_NAMES.agriculture },
  { key: 'science', label: SKILL_NAMES.science },
  { key: 'military', label: SKILL_NAMES.military },
];

const sortKey = ref<string>('');
const sortOrder = ref<'asc' | 'desc'>('asc');
const filters = reactive({
  status: '' as '' | 'normal' | 'infected' | 'mutineer' | 'frozen',
  module: '' as string,
  search: '',
});

function setSort(key: string) {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortOrder.value = 'asc';
  }
}

function getColonistStatus(c: Colonist): string {
  if (c.isCollapsed) return 'collapsed';
  if (c.isOverworked) return 'overworked';
  if (c.isFrozen) return 'frozen';
  if (c.isMutineer) return 'mutineer';
  if (c.isInfected) return 'infected';
  return 'normal';
}

const stats = computed(() => {
  const list = props.colonists;
  const total = list.length;
  let sumH = 0;
  let sumM = 0;
  let sumF = 0;
  const statusCounts = { normal: 0, infected: 0, mutineer: 0, frozen: 0, overworked: 0, collapsed: 0 };
  for (const c of list) {
    sumH += c.health;
    sumM += c.morale;
    sumF += c.fatigue ?? 0;
    statusCounts[getColonistStatus(c) as keyof typeof statusCounts]++;
  }
  return {
    total,
    avgHealth: total > 0 ? Math.round(sumH / total) : 0,
    avgMorale: total > 0 ? Math.round(sumM / total) : 0,
    avgFatigue: total > 0 ? Math.round(sumF / total) : 0,
    statusCounts,
  };
});

const avgFatigueClass = computed(() => {
  if (stats.value.avgFatigue >= 80) return 'danger';
  if (stats.value.avgFatigue >= 50) return 'warning';
  return 'good';
});

const avgHealthClass = computed(() => {
  if (stats.value.avgHealth >= 70) return 'good';
  if (stats.value.avgHealth >= 40) return 'warning';
  return 'danger';
});
const avgMoraleClass = computed(() => {
  if (stats.value.avgMorale >= 70) return 'good';
  if (stats.value.avgMorale >= 40) return 'warning';
  return 'danger';
});

const filteredColonists = computed(() => {
  let list = [...props.colonists];
  if (filters.status) {
    list = list.filter(c => getColonistStatus(c) === filters.status);
  }
  if (filters.module) {
    if (filters.module === '__unassigned') {
      list = list.filter(c => !c.assignedModule);
    } else {
      list = list.filter(c => c.assignedModule === filters.module);
    }
  }
  if (filters.search) {
    const q = filters.search.trim().toLowerCase();
    if (q) list = list.filter(c => c.name.toLowerCase().includes(q));
  }
  return list;
});

function sortCompare(a: Colonist, b: Colonist): number {
  const key = sortKey.value;
  if (!key) return 0;
  let va: any = 0;
  let vb: any = 0;
  switch (key) {
    case 'name': va = a.name; vb = b.name; break;
    case 'health': va = a.health; vb = b.health; break;
    case 'morale': va = a.morale; vb = b.morale; break;
    case 'fatigue': va = a.fatigue ?? 0; vb = b.fatigue ?? 0; break;
    case 'age': va = a.age; vb = b.age; break;
    case 'engineering':
    case 'medical':
    case 'agriculture':
    case 'science':
    case 'military':
      va = a.skills[key as SkillType];
      vb = b.skills[key as SkillType];
      break;
    case 'assignedModule':
      va = a.assignedModule || '';
      vb = b.assignedModule || '';
      break;
    case 'status':
      va = getColonistStatus(a);
      vb = getColonistStatus(b);
      break;
  }
  if (typeof va === 'string') return sortOrder.value === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  return sortOrder.value === 'asc' ? va - vb : vb - va;
}

const sortedColonists = computed(() => {
  if (!sortKey.value) return filteredColonists.value;
  return [...filteredColonists.value].sort(sortCompare);
});

const isAllSelected = computed(() => {
  if (sortedColonists.value.length === 0) return false;
  return sortedColonists.value.every(c => props.selectedIds.has(c.id));
});
const isPartiallySelected = computed(() => {
  const count = sortedColonists.value.filter(c => props.selectedIds.has(c.id)).length;
  return count > 0 && count < sortedColonists.value.length;
});

function toggleSelect(id: string) {
  const next = new Set(props.selectedIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  emit('update:selectedIds', next);
}
function toggleSelectAll(e: Event) {
  const checked = (e.target as HTMLInputElement).checked;
  const next = new Set(props.selectedIds);
  if (checked) {
    for (const c of sortedColonists.value) next.add(c.id);
  } else {
    for (const c of sortedColonists.value) next.delete(c.id);
  }
  emit('update:selectedIds', next);
}

function getModuleName(id: ModuleType | null): string {
  if (!id) return '';
  return MODULE_NAMES[id] || id;
}

function getColonistAvatarClass(c: Colonist): string {
  if (c.isFrozen) return 'frozen';
  if (c.isMutineer) return 'danger';
  if (c.isInfected) return 'warning';
  if (c.health <= 30) return 'danger';
  if (c.morale <= 30) return 'warning';
  return 'normal';
}

function onRowClick(e: MouseEvent, c: Colonist) {
  const target = e.target as HTMLElement;
  if (target.closest('input, .drag-handle')) return;
  emit('openDetail', c);
}

function onDragStart(e: DragEvent, c: Colonist) {
  emit('dragStart', c, e);
}
function onDragEnd(e: DragEvent) {
  emit('dragEnd', e);
}

watch([filters], () => {
  // 筛选变化时，如果有选中的且筛选后不可见，保留选择
}, { deep: true });
</script>

<style scoped>
.colonist-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
}

.stats-summary {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  transition: all 0.2s;
}
.stat-card:hover {
  border-color: var(--accent-blue);
}

.stat-icon {
  font-size: 24px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  border-radius: 8px;
  flex-shrink: 0;
}
.stat-icon.green { background: rgba(0, 255, 136, 0.1); }
.stat-icon.blue { background: rgba(74, 158, 255, 0.1); }
.stat-icon.danger { background: rgba(255, 68, 102, 0.1); }
.stat-icon.warning { background: rgba(255, 204, 0, 0.1); }
.stat-icon.frozen { background: rgba(0, 212, 255, 0.1); }
.stat-icon.normal { background: rgba(0, 255, 136, 0.1); }

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.stat-label {
  font-size: 11px;
  color: var(--text-muted);
}
.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.stat-value.good { color: var(--accent-green); }
.stat-value.warning { color: var(--accent-yellow); }
.stat-value.danger { color: var(--accent-red); }
.stat-value.frozen { color: var(--accent-cyan); }

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}
.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.filter-group label {
  color: var(--text-secondary);
  font-weight: 500;
}
.filter-select, .filter-input {
  padding: 6px 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: all 0.2s;
}
.filter-select:focus, .filter-input:focus {
  border-color: var(--accent-cyan);
  box-shadow: 0 0 0 2px rgba(0, 212, 255, 0.15);
}
.search-info {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 12px;
}

.table-wrapper {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
}

.colonist-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
}
.colonist-table thead {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--bg-tertiary);
}
.colonist-table th {
  padding: 10px 8px;
  text-align: left;
  font-weight: 600;
  font-size: 12px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
  user-select: none;
}
.colonist-table th.sortable {
  cursor: pointer;
  transition: color 0.2s;
}
.colonist-table th.sortable:hover {
  color: var(--accent-cyan);
}
.col-header {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.sort-icon {
  font-size: 10px;
  color: var(--accent-cyan);
}
.sort-icon.muted {
  color: var(--text-muted);
  opacity: 0.5;
}

.colonist-table td {
  padding: 8px;
  border-bottom: 1px solid rgba(42, 54, 84, 0.5);
  vertical-align: middle;
}

.col-checkbox { width: 36px; text-align: center; }
.col-drag { width: 28px; text-align: center; }
.col-name { min-width: 110px; }
.col-health, .col-morale, .col-fatigue { width: 110px; }
.col-age { width: 56px; text-align: center; }
.col-skill { width: 78px; text-align: center; }
.col-module { width: 100px; }
.col-status { width: 90px; }

.col-checkbox input,
.colonist-table thead .col-checkbox input {
  width: 15px;
  height: 15px;
  cursor: pointer;
  accent-color: var(--accent-cyan);
}

.drag-handle {
  cursor: grab;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1;
  padding: 2px;
  border-radius: 4px;
  transition: all 0.2s;
}
.drag-handle:hover {
  background: var(--bg-tertiary);
  color: var(--accent-cyan);
}
.colonist-row:active .drag-handle {
  cursor: grabbing;
}

.colonist-row {
  transition: all 0.15s;
}
.colonist-row:hover {
  background: rgba(74, 158, 255, 0.06);
  cursor: pointer;
}
.colonist-row.selected {
  background: rgba(0, 212, 255, 0.1);
}
.colonist-row.selected:hover {
  background: rgba(0, 212, 255, 0.15);
}
.colonist-row.infected {
  background: linear-gradient(90deg, rgba(255, 68, 102, 0.08), transparent);
}
.colonist-row.mutineer {
  background: linear-gradient(90deg, rgba(255, 204, 0, 0.08), transparent);
}
.colonist-row.frozen {
  background: linear-gradient(90deg, rgba(0, 212, 255, 0.08), transparent);
}
.colonist-row.overworked {
  background: linear-gradient(90deg, rgba(255, 165, 0, 0.08), transparent);
}
.colonist-row.collapsed {
  background: linear-gradient(90deg, rgba(255, 68, 102, 0.12), transparent);
}

.col-name {
  display: flex;
  align-items: center;
  gap: 8px;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}
.avatar.normal { background: linear-gradient(135deg, var(--accent-green), var(--accent-cyan)); }
.avatar.warning { background: linear-gradient(135deg, var(--accent-yellow), var(--accent-orange)); }
.avatar.danger { background: linear-gradient(135deg, var(--accent-red), #ff8899); }
.avatar.frozen { background: linear-gradient(135deg, var(--accent-blue), var(--accent-cyan)); }

.name-text {
  font-weight: 500;
  color: var(--text-primary);
}

.module-badge {
  display: inline-block;
  padding: 3px 8px;
  background: rgba(74, 158, 255, 0.15);
  color: var(--accent-blue);
  border: 1px solid rgba(74, 158, 255, 0.4);
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}
.unassigned-badge {
  display: inline-block;
  padding: 3px 8px;
  background: rgba(92, 102, 128, 0.15);
  color: var(--text-muted);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  font-size: 11px;
}

.empty-state {
  padding: 48px 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}
</style>
