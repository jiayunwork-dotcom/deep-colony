<template>
  <div class="radar-chart-wrapper" :style="{ width: size + 'px', height: size + 'px' }">
    <svg :width="size" :height="size" class="radar-chart">
      <defs>
        <radialGradient :id="fillGradId" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="var(--accent-cyan)" stop-opacity="0.6" />
          <stop offset="100%" stop-color="var(--accent-blue)" stop-opacity="0.2" />
        </radialGradient>
      </defs>

      <g :transform="centerT">
        <polygon
          v-for="l in levels"
          :key="'lvl-' + l"
          :points="getLevelPoints(l)"
          fill="none"
          stroke="var(--border-color)"
          stroke-width="1"
          stroke-dasharray="2,3"
        />

        <line
          v-for="(a, i) in axes"
          :key="'ax-' + i"
          x1="0"
          y1="0"
          :x2="getAxisEndX(i)"
          :y2="getAxisEndY(i)"
          stroke="var(--border-color)"
          stroke-width="1"
        />

        <polygon
          :points="dataPoints"
          :fill="`url(#${fillGradId})`"
          stroke="var(--accent-cyan)"
          stroke-width="2"
          stroke-linejoin="round"
        />

        <circle
          v-for="(d, i) in dataDots"
          :key="'dt-' + i"
          :cx="d.x"
          :cy="d.y"
          r="3.5"
          fill="var(--accent-cyan)"
          stroke="white"
          stroke-width="1"
        />

        <text
          v-for="(a, i) in axes"
          :key="'lbl-' + i"
          :x="getLabelX(i)"
          :y="getLabelY(i)"
          :fill="labelColor"
          font-size="11"
          font-weight="500"
          text-anchor="middle"
          dominant-baseline="middle"
        >{{ a.label }}</text>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface AxisDef {
  key: string;
  label: string;
}

const props = withDefaults(defineProps<{
  axes: AxisDef[];
  values: Record<string, number>;
  max?: number;
  size?: number;
  levelsCount?: number;
}>(), {
  max: 5,
  size: 260,
  levelsCount: 5,
});

const fillGradId = 'radar-fill-' + Math.random().toString(36).slice(2, 8);

const cx = computed(() => props.size / 2);
const cy = computed(() => props.size / 2);
const centerT = computed(() => `translate(${cx.value}, ${cy.value})`);
const radius = computed(() => props.size / 2 - 36);

const levels = computed(() => {
  const out: number[] = [];
  for (let i = 1; i <= props.levelsCount; i++) out.push(i / props.levelsCount);
  return out;
});

const n = computed(() => props.axes.length);

function angleFor(idx: number) {
  return -Math.PI / 2 + idx * (Math.PI * 2) / n.value;
}
function getX(frac: number, idx: number) {
  return Math.cos(angleFor(idx)) * radius.value * frac;
}
function getY(frac: number, idx: number) {
  return Math.sin(angleFor(idx)) * radius.value * frac;
}

function getLevelPoints(frac: number) {
  const pts: string[] = [];
  for (let i = 0; i < n.value; i++) {
    pts.push(`${getX(frac, i).toFixed(2)},${getY(frac, i).toFixed(2)}`);
  }
  return pts.join(' ');
}

function getAxisEndX(i: number) { return getX(1, i).toFixed(2); }
function getAxisEndY(i: number) { return getY(1, i).toFixed(2); }

const dataPoints = computed(() => {
  const pts: string[] = [];
  for (let i = 0; i < n.value; i++) {
    const axis = props.axes[i];
    const v = Math.max(0, Math.min(props.max, props.values[axis.key] || 0));
    const frac = v / props.max;
    pts.push(`${getX(frac, i).toFixed(2)},${getY(frac, i).toFixed(2)}`);
  }
  return pts.join(' ');
});

const dataDots = computed(() => {
  const dots = [];
  for (let i = 0; i < n.value; i++) {
    const axis = props.axes[i];
    const v = Math.max(0, Math.min(props.max, props.values[axis.key] || 0));
    const frac = v / props.max;
    dots.push({ x: getX(frac, i), y: getY(frac, i) });
  }
  return dots;
});

function getLabelX(i: number) {
  return Math.cos(angleFor(i)) * (radius.value + 22);
}
function getLabelY(i: number) {
  return Math.sin(angleFor(i)) * (radius.value + 22);
}

const labelColor = 'var(--text-primary)';
</script>

<style scoped>
.radar-chart-wrapper {
  display: inline-block;
  background: var(--bg-primary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  padding: 8px;
}

.radar-chart {
  display: block;
}
</style>
