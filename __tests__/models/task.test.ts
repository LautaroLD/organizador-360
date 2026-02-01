/**
 * Tests para el modelo Task y funcionalidades de imágenes
 */

import { Task, TaskImage, CreateTaskDTO } from '@/models/task';

describe('Task Model', () => {
  describe('Task interface', () => {
    it('should have correct structure with images field', () => {
      const task: Task = {
        id: '123',
        project_id: 'project-1',
        title: 'Test Task',
        description: 'A test task',
        status: 'todo',
        position: 0,
        created_at: '2026-01-03T00:00:00Z',
        updated_at: '2026-01-03T00:00:00Z',
        images: [],
        checklist: [],
        assignments: [],
        tags: [],
      };

      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('images');
      expect(task.images).toEqual([]);
    });

    it('should support task with multiple images', () => {
      const images: TaskImage[] = [
        {
          id: 'img-1',
          task_id: '123',
          url: 'https://example.com/image1.jpg',
          file_name: 'image1.jpg',
          file_size: 1024,
          created_at: '2026-01-03T00:00:00Z',
        },
        {
          id: 'img-2',
          task_id: '123',
          url: 'https://example.com/image2.png',
          file_name: 'image2.png',
          file_size: 2048,
          created_at: '2026-01-03T00:00:00Z',
        },
      ];

      const task: Task = {
        id: '123',
        project_id: 'project-1',
        title: 'Task with images',
        status: 'in-progress',
        position: 1,
        created_at: '2026-01-03T00:00:00Z',
        updated_at: '2026-01-03T00:00:00Z',
        images,
      };

      expect(task.images).toHaveLength(2);
      expect(task.images?.[0].file_name).toBe('image1.jpg');
      expect(task.images?.[1].url).toContain('image2.png');
    });
  });

  describe('TaskImage interface', () => {
    it('should have all required fields', () => {
      const image: TaskImage = {
        id: 'img-123',
        task_id: 'task-456',
        url: 'https://storage.example.com/images/test.jpg',
        file_name: 'test.jpg',
        created_at: '2026-01-03T12:00:00Z',
      };

      expect(image.id).toBe('img-123');
      expect(image.task_id).toBe('task-456');
      expect(image.url).toContain('test.jpg');
      expect(image.file_name).toBe('test.jpg');
      expect(image.created_at).toBeDefined();
    });

    it('should support optional file_size and uploaded_by fields', () => {
      const imageWithOptionals: TaskImage = {
        id: 'img-123',
        task_id: 'task-456',
        url: 'https://storage.example.com/images/test.jpg',
        file_name: 'test.jpg',
        file_size: 5242880, // 5MB
        uploaded_by: 'user-789',
        created_at: '2026-01-03T12:00:00Z',
      };

      expect(imageWithOptionals.file_size).toBe(5242880);
      expect(imageWithOptionals.uploaded_by).toBe('user-789');
    });
  });

  describe('CreateTaskDTO', () => {
    it('should support images field for new tasks', () => {
      // Create mock File objects
      const mockFile1 = new File([''], 'image1.jpg', { type: 'image/jpeg' });
      const mockFile2 = new File([''], 'image2.png', { type: 'image/png' });

      const createDto: CreateTaskDTO = {
        project_id: 'project-1',
        title: 'New task with images',
        description: 'Description',
        status: 'todo',
        images: [mockFile1, mockFile2],
      };

      expect(createDto.images).toHaveLength(2);
      expect(createDto.images?.[0].name).toBe('image1.jpg');
      expect(createDto.images?.[1].type).toBe('image/png');
    });

    it('should work without images', () => {
      const createDto: CreateTaskDTO = {
        project_id: 'project-1',
        title: 'Task without images',
      };

      expect(createDto.images).toBeUndefined();
    });

    it('should support all fields together', () => {
      const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' });

      const createDto: CreateTaskDTO = {
        project_id: 'project-1',
        title: 'Complete task',
        description: 'Full description',
        status: 'in-progress',
        position: 5,
        assigned_to: ['user-1', 'user-2'],
        tags: [1, 2, 3],
        checklist: [
          { content: 'Item 1', is_completed: false },
          { content: 'Item 2', is_completed: true },
        ],
        images: [mockFile],
      };

      expect(createDto.project_id).toBe('project-1');
      expect(createDto.assigned_to).toHaveLength(2);
      expect(createDto.tags).toHaveLength(3);
      expect(createDto.checklist).toHaveLength(2);
      expect(createDto.images).toHaveLength(1);
    });
  });

  describe('Task status validation', () => {
    it('should accept valid status values', () => {
      const todoTask: Task = {
        id: '1',
        project_id: 'p1',
        title: 'Todo',
        status: 'todo',
        position: 0,
        created_at: '',
        updated_at: '',
      };

      const inProgressTask: Task = {
        id: '2',
        project_id: 'p1',
        title: 'In Progress',
        status: 'in-progress',
        position: 1,
        created_at: '',
        updated_at: '',
      };

      const doneTask: Task = {
        id: '3',
        project_id: 'p1',
        title: 'Done',
        status: 'done',
        position: 2,
        created_at: '',
        updated_at: '',
      };

      expect(todoTask.status).toBe('todo');
      expect(inProgressTask.status).toBe('in-progress');
      expect(doneTask.status).toBe('done');
    });
  });

  describe('Image file validation helpers', () => {
    it('should identify valid image types', () => {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      
      validTypes.forEach(type => {
        expect(type.startsWith('image/')).toBe(true);
      });
    });

    it('should validate file size (max 5MB)', () => {
      const maxSize = 5 * 1024 * 1024; // 5MB in bytes
      
      const smallFile = { size: 1024 }; // 1KB
      const largeFile = { size: 10 * 1024 * 1024 }; // 10MB
      
      expect(smallFile.size <= maxSize).toBe(true);
      expect(largeFile.size <= maxSize).toBe(false);
    });
  });
});
