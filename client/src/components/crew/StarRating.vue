<template>
  <div class="star-rating" :title="`${value} 级`">
    <span
      v-for="i in max"
      :key="i"
      class="star"
      :class="{ filled: i <= value, half: i - 0.5 <= value && i > value }"
    >★</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  value: number;
  max?: number;
}>();
</script>

<style scoped>
.star-rating {
  display: inline-flex;
  gap: 1px;
  font-size: 13px;
  line-height: 1;
}

.star {
  color: var(--bg-primary);
  text-shadow: 0 0 0 var(--border-color);
  transition: all 0.15s;
}

.star.filled {
  color: var(--accent-yellow);
  text-shadow: 0 0 4px rgba(255, 204, 0, 0.5);
}

.star.half {
  background: linear-gradient(90deg, var(--accent-yellow) 50%, var(--border-color) 50%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}
</style>
