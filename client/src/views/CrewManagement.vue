<template>
  <div class="crew-management">
    <div class="cm-header">
      <div class="header-left">
        <button class="btn-back" @click="goBack">← 返回总览</button>
        <span class="turn-info">第 {{ gameState?.turn || 0 }} 回合</span>
      </div>
      <div class="header-center">
        <h1>深空殖民地</h1>
        <div class="nav-tabs">
          <button class="nav-tab" @click="goToOverview">飞船总览</button>
          <button class="nav-tab active">👥 殖民者管理</button>
        </div>
      </div>
      <div class="header-right">
        <button v-if="isHost" class="btn btn-next-turn" @click="nextTurn">
          下一回合 →
        </button>
      </div>
    </div>

    <div v-if="gameState" class="cm-main">
      <div class="panel-left">
        <ColonistList
          :colonists="colonistArray"
          :modules="moduleArray"
          v-model:selectedIds="selectedColonistIds"
          @openDetail="openColonistDetail"
          @dragStart="onListDragStart"
          @dragEnd="onListDragEnd"
        />
      </div>

      <div class="panel-right">
        <div class="modules-section">
          <div class="section-header">
            <h2 class="section-title">🛰 飞船模块槽位</h2>
            <div class="section-hint">
              从左侧拖拽殖民者到模块完成分配。仅可操作
              <span class="hint-key">🔑 你管理的模块</span>
            </div>
          </div>

          <div class="modules-slot-grid">
            <ModuleSlotCard
              v-for="m in moduleArray"
              :key="m.id"
              :module="m"
              :colonists="gameState.colonists"
              :is-manageable="canManageModule(m.id)"
              :hovered-colonist="dragState.draggingColonist"
              @assign="(c) => assignCrewToModule(c, m.id)"
              @crew-drag-start="onModuleCrewDragStart"
              @crew-drag-end="onModuleCrewDragEnd"
              @drag-over-change="(ov) => onModuleDragOver(m.id, ov)"
              @change-shift-mode="onChangeShiftMode"
              @reassign-shift-group="onReassignShiftGroup"
            />
          </div>
        </div>

        <div
          class="standby-section"
          :class="{
            'drag-over': standbyDragState.isOver,
            'drag-over-valid': standbyDragState.isOver && standbyDragState.canDrop,
          }"
          @dragover="onStandbyDragOver"
          @dragleave="onStandbyDragLeave"
          @drop="onStandbyDrop"
        >
          <div class="standby-header">
            <h2 class="section-title">🚪 待命区 (取消分配)</h2>
            <span class="standby-count">
              {{ unassignedCount }} 人待命
            </span>
          </div>

          <Transition name="fade">
            <div
              v-if="standbyDragState.isOver && dragState.draggingColonist"
              class="standby-preview"
              :class="{ good: standbyDragState.canDrop, bad: !standbyDragState.canDrop }"
            >
              <template v-if="!standbyDragState.canDrop && dragState.draggingColonist.assignedModule && !canManageModule(dragState.draggingColonist.assignedModule)">
                <span class="preview-icon">🔒</span>
                <span>该模块非你管理，无权移出人员</span>
              </template>
              <template v-else>
                <span class="preview-icon">📤</span>
                <span>放下 {{ dragState.draggingColonist.name }} 取消分配</span>
              </template>
            </div>
          </Transition>

          <div class="standby-area" :class="{ 'is-empty': standbyCrew.length === 0 }">
            <div
              v-for="c in standbyCrew"
              :key="c.id"
              class="standby-chip"
              :class="{
                infected: c.isInfected,
                mutineer: c.isMutineer,
                frozen: c.isFrozen
              }"
              draggable="true"
              @dragstart="onStandbyDragStart($event, c)"
              @dragend="onListDragEnd"
              @click="openColonistDetail(c)"
            >
              <div class="chip-avatar">{{ c.name.slice(0, 1) }}</div>
              <span class="chip-name">{{ c.name.slice(0, 5) }}</span>
              <StatusTag v-if="c.isInfected || c.isMutineer || c.isFrozen" :colonist="c" />
            </div>
            <div v-if="standbyCrew.length === 0" class="empty-standby">
              暂无待命人员
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="loading">加载中...</div>

    <ColonistDetail
      :visible="!!detailColonist"
      :colonist="detailColonist"
      :modules="moduleArray"
      :manageable-module-ids="myModuleIds"
      @close="detailColonist = null"
      @assign="handleDetailAssign"
    />

    <BatchActionBar
      :visible="selectedColonistIds.size > 0"
      :selected-count="selectedColonistIds.size"
      :manageable-modules="myModules"
      :loading="batchLoading"
      :last-result="lastBatchResult"
      @batchAssign="handleBatchAssign"
      @batchUnassign="handleBatchUnassign"
      @clearSelection="selectedColonistIds.clear()"
    />

    <div class="notification-area">
      <TransitionGroup name="notif">
        <div
          v-for="n in gameStore.notifications"
          :key="n.id"
          class="notification"
          :class="n.type"
        >
          <span class="notif-msg">{{ n.message }}</span>
          <button class="notif-close" @click="gameStore.dismissNotification(n.id)">×</button>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '@/stores/game';
import type { Colonist, ModuleType, PlayerAction, BatchActionResult, ShipModule, SkillType, ShiftMode, ShiftGroup } from '@deep-colony/shared';
import ColonistList from '@/components/crew/ColonistList.vue';
import ModuleSlotCard from '@/components/crew/ModuleSlotCard.vue';
import ColonistDetail from '@/components/crew/ColonistDetail.vue';
import BatchActionBar from '@/components/crew/BatchActionBar.vue';
import StatusTag from '@/components/crew/StatusTag.vue';

const route = useRoute();
const router = useRouter();
const gameStore = useGameStore();

const roomId = computed(() => route.params.roomId as string);
const gameState = computed(() => gameStore.gameState);
const isHost = computed(() => gameState.value?.hostId === gameStore.playerId);

const myModules = computed<ShipModule[]>(
  () => (gameStore.myModules as ShipModule[] | undefined) || []
);
const myModuleIds = computed<ModuleType[]>(() => myModules.value.map((m: ShipModule) => m.id));

const colonistArray = computed<Colonist[]>(() => {
  if (!gameState.value) return [];
  return Object.values(gameState.value.colonists);
});

const moduleArray = computed<ShipModule[]>(() => {
  if (!gameState.value) return [];
  return Object.values(gameState.value.modules) as ShipModule[];
});

const standbyCrew = computed<Colonist[]>(() => {
  return colonistArray.value.filter(c => !c.assignedModule);
});
const unassignedCount = computed(() => standbyCrew.value.length);

function canManageModule(moduleId: ModuleType): boolean {
  return myModuleIds.value.includes(moduleId);
}

const selectedColonistIds = ref<Set<string>>(new Set());
const detailColonist = ref<Colonist | null>(null);
const batchLoading = ref(false);
const lastBatchResult = ref<BatchActionResult | null>(null);

const dragState = reactive<{
  draggingColonist: Colonist | null;
  source: 'list' | 'module' | 'standby' | null;
  sourceModuleId: ModuleType | null;
}>({
  draggingColonist: null,
  source: null,
  sourceModuleId: null,
});

const moduleDragOverMap = reactive<Record<string, boolean>>({});
const standbyDragState = reactive({ isOver: false, canDrop: false });

function setDragData(e: DragEvent, colonist: Colonist) {
  if (!e.dataTransfer) return;
  try {
    e.dataTransfer.setData('text/colonist-id', colonist.id);
    e.dataTransfer.setData('text/plain', colonist.id);
  } catch {}
  e.dataTransfer.effectAllowed = 'move';
  if (e.dataTransfer.items && e.dataTransfer.items.length === 0) {
    const ghost = document.createElement('div');
    ghost.textContent = colonist.name;
    ghost.style.cssText = 'position:absolute;left:-9999px;padding:6px 10px;background:rgba(0,212,255,0.2);color:#00d4ff;border:1px solid #00d4ff;border-radius:6px;font-size:12px;';
    document.body.appendChild(ghost);
    try { e.dataTransfer.setDragImage(ghost, 30, 12); } catch {}
    setTimeout(() => ghost.remove(), 0);
  }
}

function onListDragStart(colonist: Colonist, e: DragEvent) {
  dragState.draggingColonist = colonist;
  dragState.source = 'list';
  dragState.sourceModuleId = colonist.assignedModule;
  setDragData(e, colonist);
}
function onListDragEnd() {
  dragState.draggingColonist = null;
  dragState.source = null;
  dragState.sourceModuleId = null;
  Object.keys(moduleDragOverMap).forEach(k => (moduleDragOverMap[k] = false));
  standbyDragState.isOver = false;
  standbyDragState.canDrop = false;
}

function onModuleCrewDragStart(colonist: Colonist, e: DragEvent) {
  dragState.draggingColonist = colonist;
  dragState.source = 'module';
  dragState.sourceModuleId = colonist.assignedModule;
  setDragData(e, colonist);
}
function onModuleCrewDragEnd() {
  onListDragEnd();
}

function onStandbyDragStart(e: DragEvent, colonist: Colonist) {
  dragState.draggingColonist = colonist;
  dragState.source = 'standby';
  dragState.sourceModuleId = null;
  setDragData(e, colonist);
}

function onModuleDragOver(moduleId: ModuleType, isOver: boolean) {
  moduleDragOverMap[moduleId] = isOver;
}

function onStandbyDragOver(e: DragEvent) {
  if (!e.dataTransfer) return;
  e.preventDefault();
  const c = dragState.draggingColonist;
  if (!c) {
    standbyDragState.canDrop = false;
    standbyDragState.isOver = true;
    return;
  }
  if (!c.assignedModule) {
    standbyDragState.canDrop = false;
  } else if (!canManageModule(c.assignedModule)) {
    standbyDragState.canDrop = false;
  } else {
    standbyDragState.canDrop = true;
  }
  standbyDragState.isOver = true;
  e.dataTransfer.dropEffect = standbyDragState.canDrop ? 'move' : 'none';
}
function onStandbyDragLeave(e: DragEvent) {
  const target = e.currentTarget as HTMLElement;
  const toEl = e.relatedTarget as HTMLElement | null;
  if (toEl && target.contains(toEl)) return;
  standbyDragState.isOver = false;
  standbyDragState.canDrop = false;
}
function onStandbyDrop(e: DragEvent) {
  if (!e.dataTransfer) return;
  e.preventDefault();
  const c = dragState.draggingColonist;
  standbyDragState.isOver = false;
  standbyDragState.canDrop = false;
  if (!c) return;
  if (!c.assignedModule) return;
  if (!canManageModule(c.assignedModule)) {
    gameStore.pushNotification('error', `无权从 ${gameState.value?.modules[c.assignedModule]?.name || '模块'} 移出人员`);
    return;
  }
  unassignCrew(c);
}

async function assignCrewToModule(colonist: Colonist, moduleId: ModuleType) {
  if (!canManageModule(moduleId)) {
    gameStore.pushNotification('error', '无权限操作该模块');
    return;
  }
  if (colonist.isMutineer || colonist.isFrozen || colonist.health <= 0) {
    gameStore.pushNotification('warning', `${colonist.name} 无法分配(叛变/冷冻/死亡)`);
    return;
  }
  const action: PlayerAction = {
    type: 'assignCrew',
    moduleId,
    colonistId: colonist.id,
  };
  await gameStore.sendAction(action);
}

async function unassignCrew(colonist: Colonist) {
  if (!colonist.assignedModule) return;
  if (!canManageModule(colonist.assignedModule)) {
    gameStore.pushNotification('error', `无权从该模块移出人员`);
    return;
  }
  const action: PlayerAction = {
    type: 'unassignCrew',
    colonistId: colonist.id,
  };
  await gameStore.sendAction(action);
}

function openColonistDetail(c: Colonist) {
  detailColonist.value = c;
}

async function handleDetailAssign(targetModuleId: ModuleType | null) {
  const c = detailColonist.value;
  if (!c) return;
  if (targetModuleId === null) {
    await unassignCrew(c);
  } else {
    await assignCrewToModule(c, targetModuleId);
  }
}

async function handleBatchAssign(moduleId: ModuleType) {
  if (!canManageModule(moduleId)) {
    gameStore.pushNotification('error', '只能分配到你管理的模块');
    return;
  }
  const ids = Array.from(selectedColonistIds.value);
  if (ids.length === 0) return;
  batchLoading.value = true;
  lastBatchResult.value = null;
  try {
    const res = await gameStore.sendBatchAction({
      type: 'batchAssign',
      moduleId,
      colonistIds: ids,
    });
    if (res) lastBatchResult.value = res;
  } finally {
    batchLoading.value = false;
    setTimeout(() => { lastBatchResult.value = null; }, 6000);
  }
}

async function handleBatchUnassign() {
  const ids = Array.from(selectedColonistIds.value);
  if (ids.length === 0) return;
  batchLoading.value = true;
  lastBatchResult.value = null;
  try {
    const res = await gameStore.sendBatchAction({
      type: 'batchUnassign',
      colonistIds: ids,
    });
    if (res) lastBatchResult.value = res;
  } finally {
    batchLoading.value = false;
    setTimeout(() => { lastBatchResult.value = null; }, 6000);
  }
}

function goBack() {
  router.push(`/game/${roomId.value}`);
}
function goToOverview() {
  router.push(`/game/${roomId.value}`);
}
async function onChangeShiftMode(moduleId: string, mode: ShiftMode) {
  const moduleIdTyped = moduleId as ModuleType;
  if (!canManageModule(moduleIdTyped)) {
    gameStore.pushNotification('error', '无权限操作该模块');
    return;
  }
  await gameStore.changeShiftMode(moduleIdTyped, mode);
}

async function onReassignShiftGroup(moduleId: string, colonistId: string, group: ShiftGroup) {
  const moduleIdTyped = moduleId as ModuleType;
  if (!canManageModule(moduleIdTyped)) {
    gameStore.pushNotification('error', '无权限操作该模块');
    return;
  }
  await gameStore.reassignShiftGroup(moduleIdTyped, colonistId, group);
}

async function nextTurn() {
  await gameStore.advanceTurn();
}

let refreshInterval: number | null = null;
onMounted(async () => {
  await gameStore.fetchRoomState(roomId.value);
  if (!gameStore.isConnected) {
    gameStore.connectWebSocket(roomId.value);
  }
  refreshInterval = window.setInterval(() => {
    gameStore.fetchRoomState(roomId.value);
  }, 2000);
});
onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval);
});
</script>

<style scoped>
.crew-management {
  min-height: 100vh;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
}

.cm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}
.header-left, .header-right {
  display: flex; align-items: center; gap: 16px; min-width: 200px;
}
.header-center {
  flex: 1; text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
}
.header-center h1 {
  font-size: 22px;
  margin: 0;
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-blue));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}
.nav-tabs {
  display: flex; gap: 4px;
  background: var(--bg-primary);
  padding: 3px; border-radius: 8px; border: 1px solid var(--border-color);
}
.nav-tab {
  padding: 6px 14px; border-radius: 6px; font-size: 13px;
  color: var(--text-secondary); background: transparent; transition: all 0.2s;
}
.nav-tab:hover { color: var(--text-primary); background: var(--bg-tertiary); }
.nav-tab.active {
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-cyan));
  color: white; font-weight: 500;
}
.btn-back {
  padding: 8px 14px; background: var(--bg-tertiary);
  border: 1px solid var(--border-color); border-radius: 6px;
  color: var(--text-secondary); font-size: 14px;
}
.btn-back:hover { color: var(--text-primary); }
.turn-info {
  font-size: 16px; font-weight: 600; color: var(--accent-cyan);
}
.btn-next-turn {
  padding: 10px 20px;
  background: linear-gradient(135deg, var(--accent-green), var(--accent-cyan));
  color: white; border-radius: 8px; font-weight: 600;
}
.btn-next-turn:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(0, 255, 136, 0.3); }

.cm-main {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 430px;
  gap: 16px;
  padding: 16px;
  overflow: hidden;
}

.panel-left {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.panel-right {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  overflow-y: auto;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
}
.section-title {
  font-size: 16px; font-weight: 600; color: var(--text-primary);
  margin: 0;
}
.section-hint {
  font-size: 11px; color: var(--text-muted);
}
.hint-key { color: var(--accent-cyan); margin: 0 2px; }

.modules-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 14px;
}
.modules-slot-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.standby-section {
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: 10px;
  padding: 14px;
  transition: all 0.2s;
  position: relative;
}
.standby-section.drag-over {
  border-color: var(--accent-orange);
  background: rgba(255, 136, 0, 0.06);
}
.standby-section.drag-over-valid {
  box-shadow: 0 0 0 2px rgba(255, 136, 0, 0.25), 0 0 18px rgba(255, 136, 0, 0.2);
}
.standby-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.standby-count {
  font-size: 12px;
  color: var(--accent-orange);
  background: rgba(255, 136, 0, 0.12);
  padding: 3px 9px;
  border-radius: 10px;
  border: 1px solid rgba(255, 136, 0, 0.3);
  font-weight: 600;
}

.standby-preview {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  padding: 10px 16px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  font-size: 13px;
  z-index: 5;
  display: flex; align-items: center; gap: 6px;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.45);
}
.standby-preview.good {
  color: var(--accent-green);
  border: 1px solid rgba(0, 255, 136, 0.4);
  background: rgba(0, 255, 136, 0.08);
}
.standby-preview.bad {
  color: var(--accent-red);
  border: 1px solid rgba(255, 68, 102, 0.4);
  background: rgba(255, 68, 102, 0.08);
}
.preview-icon { font-size: 15px; }

.standby-area {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px;
  background: var(--bg-primary);
  border: 1px dashed rgba(255, 136, 0, 0.3);
  border-radius: 8px;
  min-height: 70px;
  align-content: flex-start;
}
.standby-area.is-empty { justify-content: center; align-items: center; }
.empty-standby {
  color: var(--text-muted);
  font-size: 12px;
  opacity: 0.8;
}
.standby-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px 3px 3px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  font-size: 11px;
  cursor: grab;
  transition: all 0.15s;
}
.standby-chip:hover {
  border-color: var(--accent-orange);
  transform: translateY(-1px);
}
.standby-chip:active { cursor: grabbing; }
.standby-chip.infected { border-color: rgba(255, 68, 102, 0.5); background: rgba(255, 68, 102, 0.07); }
.standby-chip.mutineer { border-color: rgba(255, 204, 0, 0.5); background: rgba(255, 204, 0, 0.07); }
.standby-chip.frozen { border-color: rgba(0, 212, 255, 0.5); background: rgba(0, 212, 255, 0.07); }
.chip-avatar {
  width: 18px; height: 18px; border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-orange), var(--accent-yellow));
  color: white; font-size: 9px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.chip-name {
  color: var(--text-primary); font-weight: 500;
  max-width: 44px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.loading {
  flex: 1;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-secondary); font-size: 18px;
}

.fade-enter-active, .fade-leave-active { transition: all 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }

.notification-area {
  position: fixed;
  right: 20px; top: 80px;
  display: flex; flex-direction: column; gap: 8px;
  z-index: 200; pointer-events: none;
}
.notification {
  pointer-events: auto;
  min-width: 240px; max-width: 360px;
  padding: 10px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-left-width: 4px;
  border-radius: 8px;
  display: flex; justify-content: space-between; align-items: center;
  gap: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}
.notification.success { border-left-color: var(--accent-green); }
.notification.error { border-left-color: var(--accent-red); }
.notification.warning { border-left-color: var(--accent-yellow); }
.notification.info { border-left-color: var(--accent-blue); }
.notif-msg { font-size: 13px; color: var(--text-primary); }
.notif-close {
  background: none; border: none;
  color: var(--text-muted); font-size: 18px;
  line-height: 1; cursor: pointer;
}
.notif-close:hover { color: var(--text-primary); }

.notif-enter-active, .notif-leave-active { transition: all 0.25s ease; }
.notif-enter-from { opacity: 0; transform: translateX(30px); }
.notif-leave-to { opacity: 0; transform: translateX(30px); }
</style>
