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
          ),
          checklist:task_checklist_items(*),
          tags:task_tags(
            id,
            tag_id,
            tag:project_tags(*)
          ),
          images:task_images(*)
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
      const { assigned_to, tags, checklist, images, ...taskData } = newTask;

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

      // 3. Create tags if any
      if (tags && tags.length > 0) {
        const taskTags = tags.map(tagId => ({
          task_id: task.id,
          tag_id: tagId
        }));

        const { error: tagError } = await supabase
          .from('task_tags')
          .insert(taskTags);

        if (tagError) throw tagError;
      }

      // 4. Create checklist items if any
      if (checklist && checklist.length > 0) {
        const checklistItems = checklist.map((item, index) => ({
          task_id: task.id,
          content: item.content,
          is_completed: item.is_completed,
          position: index
        }));

        const { error: checklistError } = await supabase
          .from('task_checklist_items')
          .insert(checklistItems);

        if (checklistError) throw checklistError;
      }

      // 5. Upload images if any
      if (images && images.length > 0) {
        for (const file of images) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${task.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('task-images')
            .upload(fileName, file);

          if (uploadError) {
            console.error('Error uploading image:', uploadError);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('task-images')
            .getPublicUrl(fileName);

          await supabase
            .from('task_images')
            .insert({
              task_id: task.id,
              url: publicUrl,
              file_name: file.name,
              file_size: file.size
            });
        }
      }

      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTaskDTO; }) => {
      const { assigned_to, tags, ...taskData } = data;

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

      // 3. Update tags if provided
      if (tags !== undefined) {
        // Delete existing
        await supabase.from('task_tags').delete().eq('task_id', id);

        // Insert new
        if (tags.length > 0) {
          const taskTags = tags.map(tagId => ({
            task_id: id,
            tag_id: tagId
          }));

          const { error: tagError } = await supabase
            .from('task_tags')
            .insert(taskTags);

          if (tagError) throw tagError;
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

  const addChecklistItem = useMutation({
    mutationFn: async ({ taskId, content }: { taskId: string; content: string; }) => {
      const { error } = await supabase
        .from('task_checklist_items')
        .insert([{ task_id: taskId, content, position: 0 }]); // Position 0 for now, can be improved
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const updateChecklistItem = useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: boolean; }) => {
      const { error } = await supabase
        .from('task_checklist_items')
        .update({ is_completed })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const deleteChecklistItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('task_checklist_items')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const assignTag = useMutation({
    mutationFn: async ({ taskId, tagId }: { taskId: string; tagId: number; }) => {
      const { error } = await supabase
        .from('task_tags')
        .insert({ task_id: taskId, tag_id: tagId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const removeTag = useMutation({
    mutationFn: async ({ taskId, tagId }: { taskId: string; tagId: number; }) => {
      const { error } = await supabase
        .from('task_tags')
        .delete()
        .eq('task_id', taskId)
        .eq('tag_id', tagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const addTaskImage = useMutation({
    mutationFn: async ({ taskId, file }: { taskId: string; file: File; }) => {
      // Generate unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${taskId}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('task-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('task-images')
        .getPublicUrl(fileName);

      // Insert into task_images table
      const { error: insertError } = await supabase
        .from('task_images')
        .insert({
          task_id: taskId,
          url: publicUrl,
          file_name: file.name,
          file_size: file.size
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const deleteTaskImage = useMutation({
    mutationFn: async ({ imageId, imageUrl }: { imageId: string; imageUrl: string; }) => {
      // Extract file path from URL
      const urlParts = imageUrl.split('/task-images/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from('task-images').remove([filePath]);
      }

      // Delete from database
      const { error } = await supabase
        .from('task_images')
        .delete()
        .eq('id', imageId);

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
    deleteTask,
    addChecklistItem,
    updateChecklistItem,
    deleteChecklistItem,
    assignTag,
    removeTag,
    addTaskImage,
    deleteTaskImage
  };
}
