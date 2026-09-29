const taskService = require('../src/services/taskService');

describe('Task Service Unit Tests', () => {
  beforeEach(() => {
    taskService._reset();
  });

  describe('create', () => {
    it('creates a task with defaults', () => {
      const task = taskService.create({ title: 'Test Task' });
      expect(task.id).toBeDefined();
      expect(typeof task.id).toBe('string');
      expect(task.title).toBe('Test Task');
      expect(task.description).toBe('');
      expect(task.status).toBe('todo');
      expect(task.priority).toBe('medium');
      expect(task.dueDate).toBeNull();
      expect(task.completedAt).toBeNull();
      expect(task.createdAt).toBeDefined();
      // Verify ISO date string format
      expect(() => new Date(task.createdAt).toISOString()).not.toThrow();
      expect(new Date(task.createdAt).toISOString()).toBe(task.createdAt);
    });
  });

  describe('getAll / findById', () => {
    it('returns all tasks', () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });
      const tasks = taskService.getAll();
      expect(tasks).toHaveLength(2);
      expect(tasks[0].title).toBe('Task 1');
      expect(tasks[1].title).toBe('Task 2');
    });

    it('finds a task by id', () => {
      const created = taskService.create({ title: 'Find me' });
      const found = taskService.findById(created.id);
      expect(found).toBeDefined();
      expect(found.title).toBe('Find me');
    });

    it('returns undefined when finding unknown id', () => {
      expect(taskService.findById('unknown-id')).toBeUndefined();
    });
  });

  describe('getByStatus', () => {
      // BUG-1: getByStatus uses .includes() instead of strict equality (===)
    it.failing('filters by exact match only', () => {
      taskService.create({ title: 'T1', status: 'todo' });
      taskService.create({ title: 'T2', status: 'done' });
      taskService.create({ title: 'T3', status: 'in_progress' });
      
      const todoTasks = taskService.getByStatus('todo');
      expect(todoTasks).toHaveLength(1);
      expect(todoTasks[0].title).toBe('T1');

      // 'do' should not match 'todo' or 'done'
      const doTasks = taskService.getByStatus('do');
      expect(doTasks).toHaveLength(0);
    });
  });

  describe('getPaginated', () => {
    beforeEach(() => {
      for (let i = 1; i <= 25; i++) {
        taskService.create({ title: `Task ${i}` });
      }
    });

      // BUG-2: FIXED
    it('page 1 returns the first limit items', () => {
      const page1 = taskService.getPaginated(1, 10);
      expect(page1).toHaveLength(10);
      expect(page1[0].title).toBe('Task 1');
      expect(page1[9].title).toBe('Task 10');
    });

    // BUG-2: FIXED
    it('page 2 returns the next limit items', () => {
      const page2 = taskService.getPaginated(2, 10);
      expect(page2).toHaveLength(10);
      expect(page2[0].title).toBe('Task 11');
      expect(page2[9].title).toBe('Task 20');
    });

    it('page beyond the end returns empty array', () => {
      const page4 = taskService.getPaginated(4, 10);
      expect(page4).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('returns counts per status and overdue count', () => {
      // Create some tasks
      taskService.create({ title: 'Todo task', status: 'todo' });
      taskService.create({ title: 'In progress task', status: 'in_progress' });
      taskService.create({ title: 'Done task', status: 'done' });
      
      // Overdue tasks
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // yesterday
      
      taskService.create({ title: 'Overdue todo', status: 'todo', dueDate: pastDate.toISOString() });
      taskService.create({ title: 'Overdue done (should not count)', status: 'done', dueDate: pastDate.toISOString() });
      
      // Future tasks
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1); // tomorrow
      taskService.create({ title: 'Future todo', status: 'todo', dueDate: futureDate.toISOString() });

      const stats = taskService.getStats();
      expect(stats.todo).toBe(3);
      expect(stats.in_progress).toBe(1);
      expect(stats.done).toBe(2);
      expect(stats.overdue).toBe(1); // Only 'Overdue todo' should be counted
    });
    
    it('tasks with no dueDate are never overdue', () => {
        taskService.create({ title: 'No due date', status: 'todo' });
        const stats = taskService.getStats();
        expect(stats.overdue).toBe(0);
    });
  });

  describe('update', () => {
    it('applies partial update correctly', () => {
      const task = taskService.create({ title: 'Original Title' });
      const updated = taskService.update(task.id, { title: 'New Title' });
      expect(updated).toBeDefined();
      expect(updated.title).toBe('New Title');
      
      const found = taskService.findById(task.id);
      expect(found.title).toBe('New Title');
    });

    it('returns null for unknown id', () => {
      const result = taskService.update('unknown-id', { title: 'New Title' });
      expect(result).toBeNull();
    });

      // BUG-3: update performs a blind merge, overwriting immutable fields
    it.failing('does NOT allow changing id or createdAt', () => {
      const task = taskService.create({ title: 'Original Title' });
      const originalId = task.id;
      const originalCreatedAt = task.createdAt;
      
      taskService.update(task.id, { id: 'hacked-id', createdAt: '2000-01-01T00:00:00.000Z' });
      
      const found = taskService.findById(originalId);
      expect(found).toBeDefined(); // still findable by original ID
      expect(found.id).toBe(originalId);
      expect(found.createdAt).toBe(originalCreatedAt);
      
      // Make sure the new id doesn't point to anything
      const hacked = taskService.findById('hacked-id');
      expect(hacked).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('returns true on success and removes the task', () => {
      const task = taskService.create({ title: 'To be removed' });
      const result = taskService.remove(task.id);
      expect(result).toBe(true);
      
      const found = taskService.findById(task.id);
      expect(found).toBeUndefined();
    });

    it('returns false for unknown id', () => {
      const result = taskService.remove('unknown-id');
      expect(result).toBe(false);
    });
  });

  describe('completeTask', () => {
      // BUG-4: completeTask hardcodes priority to 'medium'
    it.failing('sets status done and completedAt, keeps original priority', () => {
      const task = taskService.create({ title: 'High priority task', priority: 'high' });
      const completed = taskService.completeTask(task.id);
      
      expect(completed).toBeDefined();
      expect(completed.status).toBe('done');
      expect(completed.completedAt).toBeDefined();
      expect(completed.completedAt).not.toBeNull();
      expect(completed.priority).toBe('high'); // Priority should not change
      
      const found = taskService.findById(task.id);
      expect(found.status).toBe('done');
      expect(found.priority).toBe('high');
    });

    it('returns null for unknown id', () => {
      const result = taskService.completeTask('unknown-id');
      expect(result).toBeNull();
    });
  });
});
