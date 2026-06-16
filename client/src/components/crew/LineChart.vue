<template>
  <div class="line-chart-wrapper" :style="{ width: width + 'px', height: height + 'px' }">
    <div v-if="data.length < 2" class="chart-empty">
      <span class="empty-icon">📈</span>
      <span class="empty-text">暂无历史数据</span>
      <span class="empty-hint">将在后续回合中记录健康/士气变化</span>
    </div>
    <template v-else>
    <svg :width="width" :height="height" class="line-chart">
      <defs>
        <linearGradient :id="gradIdHealth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent-green)" stop-opacity="0.4" />
          <stop offset="100%" stop-color="var(--accent-green)" stop-opacity="0" />
        </linearGradient>
        <linearGradient :id="gradIdMorale" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent-blue)" stop-opacity="0.4" />
          <stop offset="100%" stop-color="var(--accent-blue)" stop-opacity="0" />
        </linearGradient>
      </defs>

      <g class="grid-lines">
        <line
          v-for="i in 5"
          :key="'h-' + i"
          :x1="padding.left"
          :x2="width - padding.right"
          :y1="getGridY(i)"
          :y2="getGridY(i)"
          stroke="var(--border-color)"
          stroke-dasharray="3,3"
          stroke-width="1"
        />
      </g>

      <g class="y-labels">
        <text
          v-for="(v, i) in yLabels"
          :key="'yl-' + i"
          :x="padding.left - 6"
          :y="getY(100 - i * 25) + 4"
          fill="var(--text-muted)"
          font-size="10"
          text-anchor="end"
        >{{ v }}</text>
      </g>

      <g v-if="healthArea" class="area-health">
        <path :d="healthArea" :fill="`url(#${gradIdHealth})`" />
      </g>
      <g v-if="moraleArea" class="area-morale">
        <path :d="moraleArea" :fill="`url(#${gradIdMorale})`" />
      </g>

      <polyline
        v-if="healthLine"
        :points="healthLine"
        fill="none"
        stroke="var(--accent-green)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <polyline
        v-if="moraleLine"
        :points="moraleLine"
        fill="none"
        stroke="var(--accent-blue)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <g v-for="(p, i) in healthDots" :key="'hd-' + i">
        <circle :cx="p.x" :cy="p.y" r="2.5" fill="var(--accent-green)" />
      </g>
      <g v-for="(p, i) in moraleDots" :key="'md-' + i">
        <circle :cx="p.x" :cy="p.y" r="2.5" fill="var(--accent-blue)" />
      </g>

      <g class="x-labels">
        <text
          v-for="(lbl, i) in xLabels"
          :key="'xl-' + i"
          :x="getX(i / Math.max(1, data.length - 1))"
          :y="height - 4"
          fill="var(--text-muted)"
          font-size="10"
          text-anchor="middle"
        >T{{ lbl }}</text>
      </g>
    </svg>
    </template>

    <div class="chart-legend">
      <div class="legend-item">
        <span class="legend-dot legend-health"></span>
        <span>健康值</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot legend-morale"></span>
        <span>士气</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface DataPoint {
  turn: number;
  health: number;
  morale: number;
}

const props = withDefaults(defineProps<{
  data: DataPoint[];
  width?: number;
  height?: number;
}>(), {
  width: 480,
  height: 200,
});

const padding = { top: 10, right: 10, bottom: 20, left: 32 };
const chartW = computed(() => props.width - padding.left - padding.right);
const chartH = computed(() => props.height - padding.top - padding.bottom);

const gradIdHealth = 'grad-health-' + Math.random().toString(36).slice(2, 8);
const gradIdMorale = 'grad-morale-' + Math.random().toString(36).slice(2, 8);

function getX(frac: number) {
  return padding.left + frac * chartW.value;
}
function getY(val: number) {
  return padding.top + (1 - Math.max(0, Math.min(100, val)) / 100) * chartH.value;
}
function getGridY(i: number) {
  return getY((i - 1) * 25);
}

const yLabels = [100, 75, 50, 25, 0];

const data = computed(() => (props.data || []).slice(-20));

const xLabels = computed(() => {
  if (data.value.length === 0) return [];
  const len = data.value.length;
  if (len <= 6) return data.value.map(d => d.turn);
  const step = Math.ceil(len / 6);
  const out: number[] = [];
  for (let i = 0; i < len; i += step) out.push(data.value[i].turn);
  if (out[out.length - 1] !== data.value[len - 1].turn) out.push(data.value[len - 1].turn);
  return out;
});

const healthLine = computed(() => {
  if (data.value.length < 2) return '';
  return data.value.map((d, i) => {
    const frac = i / (data.value.length - 1);
    return `${getX(frac)},${getY(d.health)}`;
  }).join(' ');
});

const moraleLine = computed(() => {
  if (data.value.length < 2) return '';
  return data.value.map((d, i) => {
    const frac = i / (data.value.length - 1);
    return `${getX(frac)},${getY(d.morale)}`;
  }).join(' ');
});

function buildArea(key: 'health' | 'morale') {
  if (data.value.length < 2) return '';
  const pts = data.value.map((d, i) => {
    const frac = i / (data.value.length - 1);
    return `${getX(frac)},${getY(d[key])}`;
  });
  const firstX = getX(0);
  const lastX = getX(1);
  const bottomY = getY(0);
  return `M${firstX},${bottomY} L${pts.join(' L')} L${lastX},${bottomY} Z`;
}

const healthArea = computed(() => buildArea('health'));
const moraleArea = computed(() => buildArea('morale'));

const healthDots = computed(() => {
  return data.value.map((d, i) => {
    const frac = data.value.length <= 1 ? 0.5 : i / (data.value.length - 1);
    return { x: getX(frac), y: getY(d.health) };
  });
});
const moraleDots = computed(() => {
  return data.value.map((d, i) => {
    const frac = data.value.length <= 1 ? 0.5 : i / (data.value.length - 1);
    return { x: getX(frac), y: getY(d.morale) };
  });
});
</script>

<style scoped>
.line-chart-wrapper {
  position: relative;
  display: inline-block;
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 8px;
  border: 1px solid var(--border-color);
}

.chart-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--text-muted);
}
.empty-icon { font-size: 28px; opacity: 0.5; }
.empty-text { font-size: 14px; font-weight: 500; }
.empty-hint { font-size: 11px; opacity: 0.7; }

.line-chart {
  display: block;
}

.chart-legend {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-secondary);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.legend-health {
  background: var(--accent-green);
  box-shadow: 0 0 6px var(--accent-green);
}

.legend-morale {
  background: var(--accent-blue);
  box-shadow: 0 0 6px var(--accent-blue);
}
</style>
