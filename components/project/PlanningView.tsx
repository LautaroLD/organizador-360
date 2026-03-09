'use client';

import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useProjectStore } from '@/store/projectStore';
import type { OkrObjective, OkrKeyResult, Epic, Task, OkrKeyResultTrackingMode } from '@/models';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';

type PlanningTaskRow = Pick<Task, 'id' | 'status' | 'epic_id'>;

type ObjectiveRow = Pick<OkrObjective, 'id' | 'title' | 'description' | 'status' | 'cycle' | 'start_date' | 'end_date'>;
type KeyResultRow = Pick<OkrKeyResult, 'id' | 'objective_id' | 'title' | 'target_value' | 'current_value' | 'unit' | 'tracking_mode'>;
type EpicRow = Pick<Epic, 'id' | 'objective_id' | 'key_result_id' | 'title' | 'status' | 'color'>;

type ObjectiveFormState = {
  title: string;
  description: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  cycle: 'quarterly' | 'half-year' | 'yearly' | 'custom';
  start_date: string;
  end_date: string;
};

type KeyResultFormState = {
  objective_id: string;
  title: string;
  target_value: string;
  current_value: string;
  unit: string;
  tracking_mode: OkrKeyResultTrackingMode;
};

type EpicFormState = {
  objective_id: string;
  key_result_id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'done';
  color: string;
};

const defaultObjectiveForm: ObjectiveFormState = {
  title: '',
  description: '',
  status: 'draft',
  cycle: 'quarterly',
  start_date: '',
  end_date: '',
};

const defaultKrForm: KeyResultFormState = {
  objective_id: '',
  title: '',
  target_value: '100',
  current_value: '0',
  unit: '',
  tracking_mode: 'manual',
};

const krTrackingModeLabels: Record<OkrKeyResultTrackingMode, string> = {
  manual: 'Manual',
  auto_from_epics: 'Automatico por epicas',
  auto_from_tasks: 'Automatico por tareas',
};

const defaultEpicForm: EpicFormState = {
  objective_id: '',
  key_result_id: '',
  title: '',
  status: 'todo',
  color: '#2563eb',
};

const objectiveStatusLabels: Record<ObjectiveFormState['status'], string> = {
  draft: 'Borrador',
  active: 'Activo',
  completed: 'Completado',
  archived: 'Archivado',
};

const objectiveCycleLabels: Record<ObjectiveFormState['cycle'], string> = {
  quarterly: 'Trimestral',
  'half-year': 'Semestral',
  yearly: 'Anual',
  custom: 'Personalizado',
};

const epicStatusLabels: Record<EpicFormState['status'], string> = {
  todo: 'Por hacer',
  'in-progress': 'En progreso',
  done: 'Completado',
};

export const PlanningView: React.FC = () => {
  const supabase = createClient();
  const { currentProject } = useProjectStore();
  const queryClient = useQueryClient();
  const canManage = currentProject?.userRole === 'Owner' || currentProject?.userRole === 'Admin';

  const [objectiveModalOpen, setObjectiveModalOpen] = React.useState(false);
  const [editingObjective, setEditingObjective] = React.useState<ObjectiveRow | null>(null);
  const [objectiveForm, setObjectiveForm] = React.useState<ObjectiveFormState>(defaultObjectiveForm);

  const [krModalOpen, setKrModalOpen] = React.useState(false);
  const [editingKr, setEditingKr] = React.useState<KeyResultRow | null>(null);
  const [krForm, setKrForm] = React.useState<KeyResultFormState>(defaultKrForm);

  const [epicModalOpen, setEpicModalOpen] = React.useState(false);
  const [editingEpic, setEditingEpic] = React.useState<EpicRow | null>(null);
  const [epicForm, setEpicForm] = React.useState<EpicFormState>(defaultEpicForm);

  const resetObjectiveModal = () => {
    setEditingObjective(null);
    setObjectiveForm(defaultObjectiveForm);
    setObjectiveModalOpen(false);
  };

  const resetKrModal = () => {
    setEditingKr(null);
    setKrForm(defaultKrForm);
    setKrModalOpen(false);
  };

  const resetEpicModal = () => {
    setEditingEpic(null);
    setEpicForm(defaultEpicForm);
    setEpicModalOpen(false);
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['planning-view', currentProject?.id],
    queryFn: async () => {
      const projectId = currentProject?.id;
      if (!projectId) {
        return {
          objectives: [] as ObjectiveRow[],
          keyResults: [] as KeyResultRow[],
          epics: [] as EpicRow[],
          tasks: [] as PlanningTaskRow[],
        };
      }

      const [objectivesRes, keyResultsRes, epicsRes, tasksRes] = await Promise.all([
        supabase
          .from('okr_objectives')
          .select('id,title,description,status,cycle,start_date,end_date')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
        supabase
          .from('okr_key_results')
          .select('id,objective_id,title,target_value,current_value,unit,tracking_mode')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
        supabase
          .from('epics')
          .select('id,objective_id,key_result_id,title,status,color')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
        supabase
          .from('tasks')
          .select('id,status,epic_id')
          .eq('project_id', projectId),
      ]);

      if (objectivesRes.error) {
        throw new Error(`No se pudo leer okr_objectives: ${objectivesRes.error.message}`);
      }
      if (keyResultsRes.error) {
        throw new Error(`No se pudo leer okr_key_results: ${keyResultsRes.error.message}`);
      }
      if (epicsRes.error) {
        throw new Error(`No se pudo leer epics: ${epicsRes.error.message}`);
      }
      if (tasksRes.error) {
        throw new Error(`No se pudo leer tasks: ${tasksRes.error.message}`);
      }

      return {
        objectives: (objectivesRes.data || []) as ObjectiveRow[],
        keyResults: (keyResultsRes.data || []) as KeyResultRow[],
        epics: (epicsRes.data || []) as EpicRow[],
        tasks: (tasksRes.data || []) as PlanningTaskRow[],
      };
    },
    enabled: !!currentProject?.id,
  });

  const createObjective = useMutation({
    mutationFn: async (payload: ObjectiveFormState) => {
      const { error: insertError } = await supabase.from('okr_objectives').insert({
        project_id: currentProject!.id,
        title: payload.title,
        description: payload.description || null,
        status: payload.status,
        cycle: payload.cycle,
        start_date: payload.start_date || null,
        end_date: payload.end_date || null,
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast.success('Objetivo creado');
      queryClient.invalidateQueries({ queryKey: ['planning-view', currentProject?.id] });
      resetObjectiveModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateObjective = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: ObjectiveFormState; }) => {
      const { error: updateError } = await supabase
        .from('okr_objectives')
        .update({
          title: payload.title,
          description: payload.description || null,
          status: payload.status,
          cycle: payload.cycle,
          start_date: payload.start_date || null,
          end_date: payload.end_date || null,
        })
        .eq('id', id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('Objetivo actualizado');
      queryClient.invalidateQueries({ queryKey: ['planning-view', currentProject?.id] });
      resetObjectiveModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteObjective = useMutation({
    mutationFn: async (id: string) => {
      const { error: deleteError } = await supabase.from('okr_objectives').delete().eq('id', id);
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      toast.success('Objetivo eliminado');
      queryClient.invalidateQueries({ queryKey: ['planning-view', currentProject?.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createKr = useMutation({
    mutationFn: async (payload: KeyResultFormState) => {
      const { error: insertError } = await supabase.from('okr_key_results').insert({
        project_id: currentProject!.id,
        objective_id: payload.objective_id,
        title: payload.title,
        target_value: Number(payload.target_value),
        current_value: Number(payload.current_value),
        unit: payload.unit || null,
        tracking_mode: payload.tracking_mode,
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast.success('Resultado clave creado');
      queryClient.invalidateQueries({ queryKey: ['planning-view', currentProject?.id] });
      resetKrModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateKr = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: KeyResultFormState; }) => {
      const { error: updateError } = await supabase
        .from('okr_key_results')
        .update({
          objective_id: payload.objective_id,
          title: payload.title,
          target_value: Number(payload.target_value),
          current_value: Number(payload.current_value),
          unit: payload.unit || null,
          tracking_mode: payload.tracking_mode,
        })
        .eq('id', id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('Resultado clave actualizado');
      queryClient.invalidateQueries({ queryKey: ['planning-view', currentProject?.id] });
      resetKrModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteKr = useMutation({
    mutationFn: async (id: string) => {
      const { error: deleteError } = await supabase.from('okr_key_results').delete().eq('id', id);
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      toast.success('Resultado clave eliminado');
      queryClient.invalidateQueries({ queryKey: ['planning-view', currentProject?.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createEpic = useMutation({
    mutationFn: async (payload: EpicFormState) => {
      const { error: insertError } = await supabase.from('epics').insert({
        project_id: currentProject!.id,
        objective_id: payload.objective_id,
        key_result_id: payload.key_result_id || null,
        title: payload.title,
        status: payload.status,
        color: payload.color || '#2563eb',
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast.success('Epica creada');
      queryClient.invalidateQueries({ queryKey: ['planning-view', currentProject?.id] });
      resetEpicModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateEpic = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: EpicFormState; }) => {
      const { error: updateError } = await supabase
        .from('epics')
        .update({
          objective_id: payload.objective_id,
          key_result_id: payload.key_result_id || null,
          title: payload.title,
          status: payload.status,
          color: payload.color || '#2563eb',
        })
        .eq('id', id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('Epica actualizada');
      queryClient.invalidateQueries({ queryKey: ['planning-view', currentProject?.id] });
      resetEpicModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteEpic = useMutation({
    mutationFn: async (id: string) => {
      const { error: deleteError } = await supabase.from('epics').delete().eq('id', id);
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      toast.success('Epica eliminada');
      queryClient.invalidateQueries({ queryKey: ['planning-view', currentProject?.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openCreateObjective = () => {
    setEditingObjective(null);
    setObjectiveForm(defaultObjectiveForm);
    setObjectiveModalOpen(true);
  };

  const openEditObjective = (objective: ObjectiveRow) => {
    setEditingObjective(objective);
    setObjectiveForm({
      title: objective.title,
      description: objective.description || '',
      status: objective.status,
      cycle: objective.cycle,
      start_date: objective.start_date || '',
      end_date: objective.end_date || '',
    });
    setObjectiveModalOpen(true);
  };

  const openCreateKr = (objectiveId?: string) => {
    setEditingKr(null);
    setKrForm({ ...defaultKrForm, objective_id: objectiveId || '' });
    setKrModalOpen(true);
  };

  const openEditKr = (kr: KeyResultRow) => {
    setEditingKr(kr);
    setKrForm({
      objective_id: kr.objective_id,
      title: kr.title,
      target_value: String(kr.target_value),
      current_value: String(kr.current_value),
      unit: kr.unit || '',
      tracking_mode: kr.tracking_mode,
    });
    setKrModalOpen(true);
  };

  const openCreateEpic = (objectiveId?: string) => {
    setEditingEpic(null);
    setEpicForm({ ...defaultEpicForm, objective_id: objectiveId || '' });
    setEpicModalOpen(true);
  };

  const openEditEpic = (epic: EpicRow) => {
    setEditingEpic(epic);
    setEpicForm({
      objective_id: epic.objective_id,
      key_result_id: epic.key_result_id || '',
      title: epic.title,
      status: epic.status,
      color: epic.color,
    });
    setEpicModalOpen(true);
  };

  if (!currentProject) return null;

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-full p-12'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-primary)] mx-auto mb-4'></div>
          <p className='text-[var(--text-secondary)]'>Cargando planificacion...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return (
      <main className='flex grow flex-col max-h-full overflow-y-auto p-6'>
        <Card>
          <CardHeader>
            <CardTitle>No se pudo cargar la planificacion</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-sm text-[var(--text-secondary)]'>
              Verifica que la migracion de OKR y epicas este aplicada en Supabase.
            </p>
            <p className='text-xs text-red-500 mt-2 break-all'>
              Detalle: {message}
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const objectives = data?.objectives || [];
  const keyResults = data?.keyResults || [];
  const epics = data?.epics || [];
  const tasks = data?.tasks || [];

  const objectiveOptions = objectives.map((objective) => ({ id: objective.id, title: objective.title }));
  const keyResultOptionsForEpic = keyResults.filter((kr) => kr.objective_id === epicForm.objective_id);
  const editingEpicTaskCount = editingEpic ? tasks.filter((task) => task.epic_id === editingEpic.id).length : 0;

  const getEpicProgress = (epicId: string) => {
    const epicTasks = tasks.filter((task) => task.epic_id === epicId);
    const total = epicTasks.length;
    const done = epicTasks.filter((task) => task.status === 'done').length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    return { total, done, percent };
  };

  return (
    <main className='flex grow flex-col max-h-full overflow-y-auto p-6 space-y-4'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h2 className='text-2xl font-bold text-[var(--text-primary)]'>Planificacion OKR</h2>
          <p className='text-sm text-[var(--text-secondary)]'>
            Estructura sugerida: Objetivo - Resultado Clave - Epica - Tarea.
          </p>
        </div>
        {canManage && (
          <Button size='sm' onClick={openCreateObjective}>
            <Plus size={14} className='mr-1' />
            Nuevo objetivo
          </Button>
        )}
      </div>

      {objectives.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sin objetivos aun</CardTitle>
          </CardHeader>
          <CardContent>
            {canManage && (
              <div className='mt-3'>
                <Button size='sm' onClick={openCreateObjective}>
                  <Plus size={14} className='mr-1' />
                  Crear primer objetivo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        objectives.map((objective) => {
          const objectiveKeyResults = keyResults.filter((kr) => kr.objective_id === objective.id);
          const objectiveEpics = epics.filter((epic) => epic.objective_id === objective.id);
          const isCycleOverdue = Boolean(
            objective.end_date
            && objective.end_date < new Date().toISOString().slice(0, 10)
            && objective.status !== 'completed'
            && objective.status !== 'archived'
          );
          const cycleDateText = objective.start_date || objective.end_date
            ? `${objective.start_date || 'Sin inicio'} - ${objective.end_date || 'Sin fin'}`
            : 'Sin fechas';

          return (
            <Card key={objective.id}>
              <CardHeader>
                <div className='flex justify-between gap-2 items-start'>
                  <CardTitle>{objective.title}</CardTitle>
                  {canManage && (
                    <div className='flex gap-2'>
                      <Button size='sm' variant='ghost' onClick={() => openEditObjective(objective)}>
                        <Pencil size={14} />
                      </Button>
                      <Button
                        size='sm'
                        variant='danger'
                        onClick={() => {
                          if (confirm('Se eliminara el objetivo junto con sus KR y epicas. Continuar?')) {
                            deleteObjective.mutate(objective.id);
                          }
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  )}
                </div>
                <p className='text-xs text-[var(--text-secondary)] uppercase'>
                  Estado: {objectiveStatusLabels[objective.status]} | Ciclo: {objectiveCycleLabels[objective.cycle]}
                </p>
                <div className='flex items-center gap-2 flex-wrap'>
                  <p className='text-xs text-[var(--text-secondary)] uppercase'>
                    Fechas: {cycleDateText}
                  </p>
                  {isCycleOverdue && (
                    <span className='text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-500'>
                      Ciclo vencido
                    </span>
                  )}
                </div>
                {objective.description && (
                  <p className='text-sm text-[var(--text-secondary)]'>{objective.description}</p>
                )}
              </CardHeader>
              <CardContent className='space-y-4'>
                <div>
                  <div className='flex items-center justify-between mb-2'>
                    <h3 className='text-sm font-semibold text-[var(--text-primary)]'>Resultados Clave</h3>
                    {canManage && (
                      <Button size='sm' variant='secondary' onClick={() => openCreateKr(objective.id)}>
                        <Plus size={14} className='mr-1' /> KR
                      </Button>
                    )}
                  </div>
                  {objectiveKeyResults.length === 0 ? (
                    <p className='text-sm text-[var(--text-secondary)]'>Sin resultados clave.</p>
                  ) : (
                    <div className='space-y-2'>
                      {objectiveKeyResults.map((kr) => {
                        const progress = kr.target_value > 0
                          ? Math.min(100, Math.round((kr.current_value / kr.target_value) * 100))
                          : 0;

                        return (
                          <div key={kr.id} className='rounded-md border border-[var(--text-secondary)]/20 p-3'>
                            <div className='flex justify-between gap-2'>
                              <p className='text-sm font-medium text-[var(--text-primary)]'>{kr.title}</p>
                              {canManage && (
                                <div className='flex gap-2'>
                                  <Button size='sm' variant='ghost' onClick={() => openEditKr(kr)}>
                                    <Pencil size={14} />
                                  </Button>
                                  <Button
                                    size='sm'
                                    variant='danger'
                                    onClick={() => {
                                      if (confirm('Eliminar este resultado clave?')) {
                                        deleteKr.mutate(kr.id);
                                      }
                                    }}
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                </div>
                              )}
                            </div>
                            <p className='text-xs text-[var(--text-secondary)]'>
                              {kr.current_value}/{kr.target_value} {kr.unit || ''} ({progress}%)
                            </p>
                            <p className='text-xs text-[var(--text-secondary)]'>
                              Seguimiento: {krTrackingModeLabels[kr.tracking_mode]}
                            </p>
                            <div className='h-2 rounded-full bg-[var(--bg-primary)] overflow-hidden mt-2'>
                              <div className='h-full bg-[var(--accent-primary)]' style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <div className='flex items-center justify-between mb-2'>
                    <h3 className='text-sm font-semibold text-[var(--text-primary)]'>Epicas</h3>
                    {canManage && (
                      <Button size='sm' variant='secondary' onClick={() => openCreateEpic(objective.id)}>
                        <Plus size={14} className='mr-1' /> Epica
                      </Button>
                    )}
                  </div>
                  {objectiveEpics.length === 0 ? (
                    <p className='text-sm text-[var(--text-secondary)]'>Sin epicas.</p>
                  ) : (
                    <div className='grid gap-2 md:grid-cols-2'>
                      {objectiveEpics.map((epic) => {
                        const epicProgress = getEpicProgress(epic.id);
                        const linkedKr = keyResults.find((kr) => kr.id === epic.key_result_id);
                        return (
                          <div key={epic.id} className='rounded-md border border-[var(--text-secondary)]/20 p-3'>
                            <div className='flex justify-between gap-2'>
                              <p className='text-sm font-medium text-[var(--text-primary)]'>{epic.title}</p>
                              {canManage && (
                                <div className='flex gap-2'>
                                  <Button size='sm' variant='ghost' onClick={() => openEditEpic(epic)}>
                                    <Pencil size={14} />
                                  </Button>
                                  <Button
                                    size='sm'
                                    variant='danger'
                                    onClick={() => {
                                      if (confirm('Eliminar esta epica? Las tareas quedaran sin epica.')) {
                                        deleteEpic.mutate(epic.id);
                                      }
                                    }}
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                </div>
                              )}
                            </div>
                            <div className='flex items-center gap-2 flex-wrap'>
                              <p className='text-xs text-[var(--text-secondary)]'>Estado: {epicStatusLabels[epic.status]}</p>
                              {epicProgress.total > 0 && (
                                <span className='text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'>
                                  Auto por tareas
                                </span>
                              )}
                            </div>
                            <p className='text-xs text-[var(--text-secondary)]'>
                              KR: {linkedKr?.title || 'Sin KR'}
                            </p>
                            <p className='text-xs text-[var(--text-secondary)]'>
                              Tareas completadas: {epicProgress.done}/{epicProgress.total}
                            </p>
                            <div className='h-2 rounded-full bg-[var(--bg-primary)] overflow-hidden mt-2'>
                              <div
                                className='h-full'
                                style={{ width: `${epicProgress.percent}%`, backgroundColor: epic.color || 'var(--accent-primary)' }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <Modal
        isOpen={objectiveModalOpen}
        onClose={resetObjectiveModal}
        title={editingObjective ? 'Editar objetivo' : 'Nuevo objetivo'}
      >
        <form
          className='space-y-3'
          onSubmit={(event) => {
            event.preventDefault();
            if (!objectiveForm.title.trim()) {
              toast.error('El titulo del objetivo es obligatorio');
              return;
            }

            if (editingObjective) {
              updateObjective.mutate({ id: editingObjective.id, payload: objectiveForm });
              return;
            }

            createObjective.mutate(objectiveForm);
          }}
        >
          <Input
            label='Titulo'
            value={objectiveForm.title}
            onChange={(event) => setObjectiveForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder='Ej: Mejorar adopcion del producto'
          />
          <div>
            <label className='text-sm text-[var(--text-secondary)] mb-1 block'>Descripcion</label>
            <textarea
              className='w-full p-2 rounded-md bg-[var(--bg-primary)] border border-[var(--text-secondary)] text-[var(--text-primary)]'
              value={objectiveForm.description}
              onChange={(event) => setObjectiveForm((prev) => ({ ...prev, description: event.target.value }))}
              rows={3}
            />
          </div>
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <label className='text-sm text-[var(--text-secondary)] mb-1 block'>Estado</label>
              <select
                className='w-full p-2 rounded-md bg-[var(--bg-primary)] border border-[var(--text-secondary)] text-[var(--text-primary)]'
                value={objectiveForm.status}
                onChange={(event) => setObjectiveForm((prev) => ({ ...prev, status: event.target.value as ObjectiveFormState['status'] }))}
              >
                <option value='draft'>{objectiveStatusLabels.draft}</option>
                <option value='active'>{objectiveStatusLabels.active}</option>
                <option value='completed'>{objectiveStatusLabels.completed}</option>
                <option value='archived'>{objectiveStatusLabels.archived}</option>
              </select>
            </div>
            <div>
              <label className='text-sm text-[var(--text-secondary)] mb-1 block'>Ciclo</label>
              <select
                className='w-full p-2 rounded-md bg-[var(--bg-primary)] border border-[var(--text-secondary)] text-[var(--text-primary)]'
                value={objectiveForm.cycle}
                onChange={(event) => setObjectiveForm((prev) => ({ ...prev, cycle: event.target.value as ObjectiveFormState['cycle'] }))}
              >
                <option value='quarterly'>{objectiveCycleLabels.quarterly}</option>
                <option value='half-year'>{objectiveCycleLabels['half-year']}</option>
                <option value='yearly'>{objectiveCycleLabels.yearly}</option>
                <option value='custom'>{objectiveCycleLabels.custom}</option>
              </select>
            </div>
          </div>
          <div className='grid grid-cols-2 gap-3'>
            <Input
              label='Inicio del ciclo'
              type='date'
              value={objectiveForm.start_date}
              onChange={(event) => setObjectiveForm((prev) => ({ ...prev, start_date: event.target.value }))}
            />
            <Input
              label='Fin del ciclo'
              type='date'
              value={objectiveForm.end_date}
              onChange={(event) => setObjectiveForm((prev) => ({ ...prev, end_date: event.target.value }))}
            />
          </div>
          <div className='flex justify-end gap-2 pt-2'>
            <Button type='button' variant='ghost' onClick={resetObjectiveModal}>Cancelar</Button>
            <Button type='submit'>{editingObjective ? 'Guardar' : 'Crear objetivo'}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={krModalOpen}
        onClose={resetKrModal}
        title={editingKr ? 'Editar resultado clave' : 'Nuevo resultado clave'}
      >
        <form
          className='space-y-3'
          onSubmit={(event) => {
            event.preventDefault();
            if (!krForm.objective_id || !krForm.title.trim()) {
              toast.error('Objetivo y titulo son obligatorios');
              return;
            }

            if (editingKr) {
              updateKr.mutate({ id: editingKr.id, payload: krForm });
              return;
            }

            createKr.mutate(krForm);
          }}
        >
          <div>
            <label className='text-sm text-[var(--text-secondary)] mb-1 block'>Objetivo</label>
            <select
              className='w-full p-2 rounded-md bg-[var(--bg-primary)] border border-[var(--text-secondary)] text-[var(--text-primary)]'
              value={krForm.objective_id}
              onChange={(event) => setKrForm((prev) => ({ ...prev, objective_id: event.target.value }))}
            >
              <option value=''>Seleccionar objetivo</option>
              {objectiveOptions.map((objective) => (
                <option key={objective.id} value={objective.id}>{objective.title}</option>
              ))}
            </select>
          </div>
          <Input
            label='Titulo'
            value={krForm.title}
            onChange={(event) => setKrForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder='Ej: Aumentar WAU'
          />
          <div className='grid grid-cols-3 gap-3'>
            <Input
              label='Target'
              type='number'
              min='0'
              value={krForm.target_value}
              onChange={(event) => setKrForm((prev) => ({ ...prev, target_value: event.target.value }))}
            />
            <Input
              label='Actual'
              type='number'
              min='0'
              value={krForm.current_value}
              onChange={(event) => setKrForm((prev) => ({ ...prev, current_value: event.target.value }))}
              disabled={krForm.tracking_mode !== 'manual'}
            />
            <Input
              label='Unidad'
              value={krForm.unit}
              onChange={(event) => setKrForm((prev) => ({ ...prev, unit: event.target.value }))}
              placeholder='usuarios'
            />
          </div>
          <div>
            <label className='text-sm text-[var(--text-secondary)] mb-1 block'>Seguimiento</label>
            <select
              className='w-full p-2 rounded-md bg-[var(--bg-primary)] border border-[var(--text-secondary)] text-[var(--text-primary)]'
              value={krForm.tracking_mode}
              onChange={(event) => {
                const nextMode = event.target.value as OkrKeyResultTrackingMode;
                setKrForm((prev) => ({
                  ...prev,
                  tracking_mode: nextMode,
                  current_value: nextMode === 'manual' ? prev.current_value : '0',
                }));
              }}
            >
              <option value='manual'>{krTrackingModeLabels.manual}</option>
              <option value='auto_from_epics'>{krTrackingModeLabels.auto_from_epics}</option>
              <option value='auto_from_tasks'>{krTrackingModeLabels.auto_from_tasks}</option>
            </select>
            <p className='text-xs text-[var(--text-secondary)] mt-1'>
              En modos automaticos, el valor actual se recalcula solo segun epicas/tareas completadas.
            </p>
          </div>
          <div className='flex justify-end gap-2 pt-2'>
            <Button type='button' variant='ghost' onClick={resetKrModal}>Cancelar</Button>
            <Button type='submit'>{editingKr ? 'Guardar' : 'Crear KR'}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={epicModalOpen}
        onClose={resetEpicModal}
        title={editingEpic ? 'Editar epica' : 'Nueva epica'}
      >
        <form
          className='space-y-3'
          onSubmit={(event) => {
            event.preventDefault();
            if (!epicForm.objective_id || !epicForm.title.trim()) {
              toast.error('Objetivo y titulo son obligatorios');
              return;
            }

            if (editingEpic) {
              updateEpic.mutate({ id: editingEpic.id, payload: epicForm });
              return;
            }

            createEpic.mutate(epicForm);
          }}
        >
          <div>
            <label className='text-sm text-[var(--text-secondary)] mb-1 block'>Objetivo</label>
            <select
              className='w-full p-2 rounded-md bg-[var(--bg-primary)] border border-[var(--text-secondary)] text-[var(--text-primary)]'
              value={epicForm.objective_id}
              onChange={(event) => setEpicForm((prev) => ({ ...prev, objective_id: event.target.value, key_result_id: '' }))}
            >
              <option value=''>Seleccionar objetivo</option>
              {objectiveOptions.map((objective) => (
                <option key={objective.id} value={objective.id}>{objective.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className='text-sm text-[var(--text-secondary)] mb-1 block'>KR (opcional)</label>
            <select
              className='w-full p-2 rounded-md bg-[var(--bg-primary)] border border-[var(--text-secondary)] text-[var(--text-primary)]'
              value={epicForm.key_result_id}
              onChange={(event) => setEpicForm((prev) => ({ ...prev, key_result_id: event.target.value }))}
            >
              <option value=''>Sin KR</option>
              {keyResultOptionsForEpic.map((kr) => (
                <option key={kr.id} value={kr.id}>{kr.title}</option>
              ))}
            </select>
          </div>
          <Input
            label='Titulo'
            value={epicForm.title}
            onChange={(event) => setEpicForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder='Ej: Onboarding guiado v2'
          />
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <label className='text-sm text-[var(--text-secondary)] mb-1 block'>Estado</label>
              <select
                className='w-full p-2 rounded-md bg-[var(--bg-primary)] border border-[var(--text-secondary)] text-[var(--text-primary)]'
                value={epicForm.status}
                onChange={(event) => setEpicForm((prev) => ({ ...prev, status: event.target.value as EpicFormState['status'] }))}
                disabled={editingEpicTaskCount > 0}
              >
                <option value='todo'>{epicStatusLabels.todo}</option>
                <option value='in-progress'>{epicStatusLabels['in-progress']}</option>
                <option value='done'>{epicStatusLabels.done}</option>
              </select>
              {editingEpicTaskCount > 0 && (
                <p className='text-xs text-[var(--text-secondary)] mt-1'>
                  Esta epica tiene tareas vinculadas. El estado se actualiza automaticamente segun esas tareas.
                </p>
              )}
            </div>
            <Input
              label='Color'
              type='color'
              value={epicForm.color}
              onChange={(event) => setEpicForm((prev) => ({ ...prev, color: event.target.value }))}
              className='h-10 p-1'
            />
          </div>
          <div className='flex justify-end gap-2 pt-2'>
            <Button type='button' variant='ghost' onClick={resetEpicModal}>Cancelar</Button>
            <Button type='submit'>{editingEpic ? 'Guardar' : 'Crear epica'}</Button>
          </div>
        </form>
      </Modal>
    </main>
  );
};
