import type { GameState } from '@deep-colony/shared';
import { addLog } from './state';

export function canResearchTech(state: GameState, techId: string): boolean {
  const tech = state.techTree[techId];
  if (!tech || tech.researched) return false;
  if (state.currentTech) return false;

  for (const prereq of tech.prerequisites) {
    if (!state.techTree[prereq]?.researched) return false;
  }

  return true;
}

export function startResearch(state: GameState, techId: string): boolean {
  if (!canResearchTech(state, techId)) return false;

  state.currentTech = techId;
  addLog(state, `开始研究科技: ${state.techTree[techId].name}`, 'info');
  return true;
}

export function processResearch(state: GameState): void {
  if (!state.currentTech) return;

  const tech = state.techTree[state.currentTech];
  if (!tech) return;

  if (state.techPoints >= tech.cost) {
    state.techPoints -= tech.cost;
    tech.researched = true;
    state.currentTech = undefined;
    addLog(state, `🎉 科技研究完成: ${tech.name} - ${tech.description}`, 'success');
  }
}

export function getResearchProgress(state: GameState): number {
  if (!state.currentTech) return 0;
  const tech = state.techTree[state.currentTech];
  if (!tech) return 0;
  return Math.min(1, state.techPoints / tech.cost);
}
