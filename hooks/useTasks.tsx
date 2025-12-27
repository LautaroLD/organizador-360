'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Task, CreateTaskDTO, UpdateTaskDTO } from '@/models';

export function useTasks(projectId: string) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const { data: tasks, isLoading, error } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assignments:task_assignments(
            user_id,
            user:users(id, name, email)
          )
        `)
        .eq('project_id', projectId)
        .order('position');

      if (error) throw error;
      return data as Task[];
    },
    enabled: !!projectId,
  });

  const createTask = useMutation({
    mutationFn: async (newTask: CreateTaskDTO) => {
      const { assigned_to, ...taskData } = newTask;

      // 1. Create task
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert([taskData])
        .select()
        .single();

      if (taskError) throw taskError;

      // 2. Create assignments if any
      if (assigned_to && assigned_to.length > 0) {
        const assignments = assigned_to.map(userId => ({
          task_id: task.id,
          user_id: userId
        }));

        const { error: assignError } = await supabase
          .from('task_assignments')
          .insert(assignments);

        if (assignError) throw assignError;
      }

      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTaskDTO; }) => {
      const { assigned_to, ...taskData } = data;

      // 1. Update task fields
      if (Object.keys(taskData).length > 0) {
        const { error: updateError } = await supabase
          .from('tasks')
          .update(taskData)
          .eq('id', id);

        if (updateError) throw updateError;
      }

      // 2. Update assignments if provided
      if (assigned_to !== undefined) {
        // Delete existing
        await supabase.from('task_assignments').delete().eq('task_id', id);

        // Insert new
        if (assigned_to.length > 0) {
          const assignments = assigned_to.map(userId => ({
            task_id: id,
            user_id: userId
          }));

          const { error: assignError } = await supabase
            .from('task_assignments')
            .insert(assignments);

          if (assignError) throw assignError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  return {
    tasks,
    isLoading,
    error,
    createTask,
    updateTask,
    deleteTask
  };
}
