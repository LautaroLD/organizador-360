/**
 * Roadmap Models
 * Tipos relacionados con roadmap y fases
 */

export interface Roadmap {
  id: number;
  created_at: string;
  project_id: string | null;
}

export interface CreateRoadmapDTO {
  project_id: string;
}

export interface UpdateRoadmapDTO {
  project_id?: string | null;
}

export interface RoadmapPhase {
  id: number;
  created_at: string;
  roadmap_id: number;
  name: string;
  init_at: string;
  end_at: string;
  description: string | null;
}

export interface CreateRoadmapPhaseDTO {
  roadmap_id: number;
  name: string;
  init_at: string;
  end_at: string;
  description?: string | null;
}

export interface UpdateRoadmapPhaseDTO {
  id: number;
  roadmap_id?: number;
  name?: string;
  init_at?: string;
  end_at?: string;
  description?: string | null;
}
