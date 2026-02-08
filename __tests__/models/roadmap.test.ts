/**
 * Tests para los modelos de Roadmap
 */

import {
  Roadmap,
  RoadmapPhase,
  CreateRoadmapDTO,
  UpdateRoadmapDTO,
  CreateRoadmapPhaseDTO,
  UpdateRoadmapPhaseDTO,
} from '@/models/roadmap';

describe('Roadmap Models', () => {
  it('should allow creating roadmap DTOs', () => {
    const createDto: CreateRoadmapDTO = {
      project_id: 'project-123',
    };

    const updateDto: UpdateRoadmapDTO = {
      project_id: null,
    };

    expect(createDto.project_id).toBe('project-123');
    expect(updateDto.project_id).toBeNull();
  });

  it('should allow roadmap phase DTOs', () => {
    const createPhaseDto: CreateRoadmapPhaseDTO = {
      roadmap_id: 42,
      name: 'Planificacion',
      init_at: '2026-02-01',
      end_at: '2026-02-10',
      description: null,
    };

    const updatePhaseDto: UpdateRoadmapPhaseDTO = {
      id: 7,
      name: 'Ejecucion',
    };

    expect(createPhaseDto.roadmap_id).toBe(42);
    expect(updatePhaseDto.id).toBe(7);
  });

  it('should allow roadmap and phase entities', () => {
    const roadmap: Roadmap = {
      id: 1,
      created_at: '2026-02-01T00:00:00Z',
      project_id: 'project-123',
    };

    const phase: RoadmapPhase = {
      id: 10,
      created_at: '2026-02-01T00:00:00Z',
      roadmap_id: 1,
      name: 'Cierre',
      init_at: '2026-02-11',
      end_at: '2026-02-20',
      description: 'Entrega final',
    };

    expect(roadmap.id).toBe(1);
    expect(phase.roadmap_id).toBe(1);
  });
});
