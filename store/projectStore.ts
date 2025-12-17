import { create } from 'zustand';
import type { ProjectStore } from '@/models';

export const useProjectStore = create<ProjectStore>((set) => ({
  currentProject: null,
  setCurrentProject: (project) => set({ currentProject: project }),
}));
