import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import {
  RoadmapPhase,
  CreateRoadmapDTO,
  CreateRoadmapPhaseDTO,
  UpdateRoadmapPhaseDTO,
} from '@/models';
import { Map } from 'lucide-react';
import React from 'react';
import { toast } from 'react-toastify';
import { useQueryClient } from '@tanstack/react-query';

type RoadmapPhaseForm = Omit<RoadmapPhase, 'id' | 'created_at' | 'roadmap_id' | 'description'> & {
  id?: number;
  description: string;
};

type CreateRoadmapProps = {
  projectId: string;
};

export default function CreateRoadmap({ projectId }: CreateRoadmapProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [canManageRoadmap, setCanManageRoadmap] = React.useState(false);
  const [isRoleLoading, setIsRoleLoading] = React.useState(true);
  const [roadmapId, setRoadmapId] = React.useState<number | null>(null);
  const [isRoadmapLoading, setIsRoadmapLoading] = React.useState(true);
  const queryClient = useQueryClient();
  const supabase = createClient();
  const getTodayISO = React.useCallback(() => new Date().toISOString().split('T')[0], []);
  const createPhase = React.useCallback(
    (name = ''): RoadmapPhaseForm => ({
      name,
      init_at: getTodayISO(),
      end_at: getTodayISO(),
      description: '',
    }),
    [getTodayISO]
  );

  const getDefaultPhases = React.useCallback(
    () => [
      createPhase('Planificación'),
      createPhase('Ejecución'),
      createPhase('Cierre'),
    ],
    [createPhase]
  );

  const [phases, setPhases] = React.useState<RoadmapPhaseForm[]>(() => getDefaultPhases());

  const updatePhase = React.useCallback(
    (index: number, updates: Partial<RoadmapPhaseForm>) => {
      setPhases((prev) =>
        prev.map((phase, i) => (i === index ? { ...phase, ...updates } : phase))
      );
    },
    []
  );

  const addPhase = React.useCallback(() => {
    setPhases((prev) => [...prev, createPhase('')]);
  }, [createPhase]);

  const removePhase = React.useCallback((index: number) => {
    setPhases((prev) => {
      const phase = prev[index];
      if (phase?.id) {
        toast.error('No puedes eliminar una fase existente porque hay tareas vinculadas.');
        return prev;
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const canCreate = React.useMemo(() => {
    if (phases.length === 0) {
      return false;
    }

    return phases.every((phase) => {
      if (!phase.name.trim() || !phase.init_at || !phase.end_at) {
        return false;
      }

      return phase.init_at <= phase.end_at;
    });
  }, [phases]);

  React.useEffect(() => {
    if (!canManageRoadmap) {
      return;
    }

    let isMounted = true;
    const loadRoadmap = async () => {
      setIsRoadmapLoading(true);
      try {
        const { data, error } = await supabase
          .from('roadmap')
          .select('id')
          .eq('project_id', projectId)
          .maybeSingle();

        if (!isMounted) {
          return;
        }

        if (error) {
          setRoadmapId(null);
          return;
        }

        setRoadmapId(data?.id ?? null);
      } finally {
        if (isMounted) {
          setIsRoadmapLoading(false);
        }
      }
    };

    loadRoadmap();

    return () => {
      isMounted = false;
    };
  }, [canManageRoadmap, projectId, supabase]);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isMounted = true;
    const loadPhases = async () => {
      if (!roadmapId) {
        if (isMounted) {
          setPhases(getDefaultPhases());
        }
        return;
      }

      const { data, error } = await supabase
        .from('phase_roadmap')
        .select('name, init_at, end_at, description, id')
        .eq('roadmap_id', roadmapId)
        .order('id');

      if (!isMounted) {
        return;
      }

      if (error || !data) {
        setPhases(getDefaultPhases());
        return;
      }

      setPhases(
        data.map((phase) => ({
          id: phase.id,
          name: phase.name,
          init_at: phase.init_at,
          end_at: phase.end_at,
          description: phase.description || '',
        }))
      );
    };

    loadPhases();

    return () => {
      isMounted = false;
    };
  }, [getDefaultPhases, isOpen, roadmapId, supabase]);

  React.useEffect(() => {
    let isMounted = true;

    const loadRole = async () => {
      setIsRoleLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (isMounted) {
            setCanManageRoadmap(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from('project_members')
          .select('role')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .single();

        if (error || !data) {
          if (isMounted) {
            setCanManageRoadmap(false);
          }
          return;
        }

        const allowedRoles = new Set(['Owner', 'Admin']);
        if (isMounted) {
          setCanManageRoadmap(allowedRoles.has(data.role));
        }
      } catch {
        if (isMounted) {
          setCanManageRoadmap(false);
        }
      } finally {
        if (isMounted) {
          setIsRoleLoading(false);
        }
      }
    };

    loadRole();

    return () => {
      isMounted = false;
    };
  }, [projectId, supabase]);

  const handleSaveRoadmap = React.useCallback(async () => {
    if (!canCreate || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      let currentRoadmapId = roadmapId;

      if (!currentRoadmapId) {
        const newRoadmap: CreateRoadmapDTO = { project_id: projectId };
        const { data: roadmap, error: roadmapError } = await supabase
          .from('roadmap')
          .insert(newRoadmap)
          .select('id')
          .single();

        if (roadmapError || !roadmap) {
          throw new Error(roadmapError?.message || 'No se pudo crear el roadmap');
        }

        currentRoadmapId = roadmap.id;
        setRoadmapId(currentRoadmapId);
      }

      if (!currentRoadmapId) {
        throw new Error('No se pudo obtener el roadmap');
      }

      const existingPhases = phases.filter((phase) => phase.id);
      const newPhases = phases.filter((phase) => !phase.id);

      if (existingPhases.length > 0) {
        const updatePayload: UpdateRoadmapPhaseDTO[] = existingPhases.map((phase) => ({
          id: phase.id as number,
          roadmap_id: currentRoadmapId,
          name: phase.name.trim(),
          init_at: phase.init_at,
          end_at: phase.end_at,
          description: phase.description.trim() ? phase.description.trim() : null,
        }));
        const { error: updateError } = await supabase
          .from('phase_roadmap')
          .upsert(updatePayload, { onConflict: 'id' });

        if (updateError) {
          throw new Error(updateError.message || 'No se pudieron actualizar las fases');
        }
      }

      if (newPhases.length > 0) {
        const insertPayload: CreateRoadmapPhaseDTO[] = newPhases.map((phase) => ({
          roadmap_id: currentRoadmapId,
          name: phase.name.trim(),
          init_at: phase.init_at,
          end_at: phase.end_at,
          description: phase.description.trim() ? phase.description.trim() : null,
        }));
        const { error: insertError } = await supabase
          .from('phase_roadmap')
          .insert(insertPayload);

        if (insertError) {
          throw new Error(insertError.message || 'No se pudieron crear las fases');
        }
      }

      toast.success(roadmapId ? 'Roadmap actualizado exitosamente' : 'Roadmap creado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['roadmap-phases', projectId] });
      setIsOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al crear el roadmap';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }, [canCreate, isSaving, phases, projectId, queryClient, roadmapId, supabase]);

  if (isRoleLoading || !canManageRoadmap) {
    return null;
  }

  const actionLabel = roadmapId ? 'Editar Roadmap' : 'Crear Roadmap';
  const modalTitle = roadmapId ? 'Editar Roadmap' : 'Crear Roadmap';
  return (
    <>
      <Button size='sm' variant='ghost' onClick={() => setIsOpen(true)} disabled={isRoadmapLoading}>
        <Map size={20} />
        <p className='hidden md:flex md:ml-1'>
          {isRoadmapLoading ? 'Cargando...' : actionLabel}
        </p>
      </Button>
      {isOpen && (
        <Modal size='xl' isOpen={isOpen} onClose={() => setIsOpen(false)} title={modalTitle}>
          <div>
            <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
              {phases.map((phase, index) => (
                <div key={index} className=" p-3 bg-[var(--bg-primary)] rounded-md space-y-2">
                  <div className="flex items-center justify-between">
                    <b>Fase {index + 1}</b>
                    {phases.length > 1 && (
                      <Button variant="ghost" onClick={() => removePhase(index)} size='sm' className='text-[var(--accent-danger)]'>
                        Quitar
                      </Button>
                    )}
                  </div>
                  <Input
                    value={phase.name}
                    label="Nombre de la fase"
                    onChange={(event) => {
                      updatePhase(index, { name: event?.currentTarget.value || '' });
                    }}
                  />
                  <textarea
                    value={phase.description}
                    placeholder="Descripción de la fase (opcional)"
                    className="w-full rounded-md border border-[var(--text-secondary)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                    onChange={(event) => {
                      updatePhase(index, { description: event?.currentTarget.value || '' });
                    }}
                  />
                  <div className="flex gap-4">
                    <Input
                      value={phase.init_at}
                      label="Fecha de inicio"
                      type="date"
                      className="mt-2"
                      onChange={(event) => {
                        updatePhase(index, { init_at: event?.currentTarget.value || '' });
                      }}
                    />
                    <Input
                      value={phase.end_at}
                      label="Fecha de fin"
                      type="date"
                      className="mt-2"
                      onChange={(event) => {
                        updatePhase(index, { end_at: event?.currentTarget.value || '' });
                      }}
                    />
                  </div>
                  {phase.init_at && phase.end_at && phase.init_at > phase.end_at && (
                    <p className="text-xs text-red-500">
                      La fecha de fin debe ser posterior a la fecha de inicio.
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <div className="flex-1">
                <Button variant='secondary' onClick={addPhase}>
                  Agregar Fase
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant='ghost' onClick={() => setIsOpen(false)} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button disabled={!canCreate || isSaving} onClick={handleSaveRoadmap}>
                  {isSaving ? 'Guardando...' : (roadmapId ? 'Actualizar Roadmap' : 'Crear Roadmap')}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
