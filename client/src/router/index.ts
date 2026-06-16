import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/HomeView.vue'),
  },
  {
    path: '/room/:roomId',
    name: 'GameRoom',
    component: () => import('@/views/GameRoom.vue'),
  },
  {
    path: '/game/:roomId',
    name: 'Game',
    component: () => import('@/views/GameView.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
