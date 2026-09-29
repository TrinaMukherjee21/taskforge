const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');
const validators = require('../src/utils/validators');

describe('Assign Task Feature Tests', () => {
  beforeEach(() => {
    taskService._reset();
  });

  describe('Unit Tests: validateAssignTask', () => {
    it('returns null (no error) for valid assignee', () => {
      expect(validators.validateAssignTask({ assignee: 'Trina' })).toBeNull();
      expect(validators.validateAssignTask({ assignee: '   Trina   ' })).toBeNull();
    });

    it('returns error if assignee is missing', () => {
      expect(validators.validateAssignTask({})).not.toBeNull();
    });

    it('returns error if assignee is not a string', () => {
      expect(validators.validateAssignTask({ assignee: 123 })).not.toBeNull();
    });

    it('returns error if assignee is empty or whitespace-only', () => {
      expect(validators.validateAssignTask({ assignee: '' })).not.toBeNull();
      expect(validators.validateAssignTask({ assignee: '   ' })).not.toBeNull();
    });

    it('returns error if assignee is longer than 100 characters', () => {
      const longName = 'A'.repeat(101);
      expect(validators.validateAssignTask({ assignee: longName })).not.toBeNull();
      
      const maxLengthName = 'A'.repeat(100);
      expect(validators.validateAssignTask({ assignee: maxLengthName })).toBeNull();
    });
  });

  describe('Unit Tests: assignTask', () => {
    it('assigns the task, trimming the name', () => {
      const task = taskService.create({ title: 'Task 1' });
      const updated = taskService.assignTask(task.id, '  Trina  ');
      
      expect(updated).toBeDefined();
      expect(updated.assignee).toBe('Trina');
      
      const found = taskService.findById(task.id);
      expect(found.assignee).toBe('Trina');
    });

    it('returns null for unknown id', () => {
      const result = taskService.assignTask('unknown-id', 'Trina');
      expect(result).toBeNull();
    });

    it('newly created tasks have assignee: null', () => {
      const task = taskService.create({ title: 'Task 2' });
      expect(task.assignee).toBeNull();
    });
  });

  describe('Integration Tests: PATCH /tasks/:id/assign', () => {
    it('returns 200 and updates task assignee with trimmed name', async () => {
      const task = taskService.create({ title: 'Assign me' });
      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: '  Alice  ' });
      
      expect(res.status).toBe(200);
      expect(res.body.assignee).toBe('Alice');
      
      const found = taskService.findById(task.id);
      expect(found.assignee).toBe('Alice');
    });

    it('returns 404 if task id does not exist', async () => {
      const res = await request(app)
        .patch('/tasks/unknown-id/assign')
        .send({ assignee: 'Alice' });
      
      expect(res.status).toBe(404);
    });

    it('runs validation before checking 404', async () => {
      const res = await request(app)
        .patch('/tasks/unknown-id/assign')
        .send({ assignee: '' });
      
      expect(res.status).toBe(400); // Bad Request before Not Found
    });

    it('returns 400 for missing assignee', async () => {
      const task = taskService.create({ title: 'T' });
      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({});
      
      expect(res.status).toBe(400);
    });

    it('returns 400 for non-string assignee', async () => {
      const task = taskService.create({ title: 'T' });
      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 123 });
      
      expect(res.status).toBe(400);
    });

    it('returns 400 for empty or whitespace-only assignee', async () => {
      const task = taskService.create({ title: 'T' });
      const res1 = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: '' });
      expect(res1.status).toBe(400);
      
      const res2 = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: '   ' });
      expect(res2.status).toBe(400);
    });

    it('returns 400 for assignee longer than 100 characters', async () => {
      const task = taskService.create({ title: 'T' });
      const longName = 'A'.repeat(101);
      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: longName });
      
      expect(res.status).toBe(400);
    });

    it('allows reassigning an already assigned task (overwrite)', async () => {
      const task = taskService.create({ title: 'T' });
      await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'Alice' });
      
      const res = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'Bob' });
      expect(res.status).toBe(200);
      expect(res.body.assignee).toBe('Bob');
    });

    it('does not change any other fields (status, priority, etc.)', async () => {
      const task = taskService.create({ title: 'T', status: 'in_progress', priority: 'high' });
      const originalCreatedAt = task.createdAt;
      
      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'Alice' });
      
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('in_progress');
      expect(res.body.priority).toBe('high');
      expect(res.body.createdAt).toBe(originalCreatedAt);
      expect(res.body.title).toBe('T');
    });

    it('POST /tasks returns a task with assignee: null', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'New Task' });
      
      expect(res.status).toBe(201);
      expect(res.body.assignee).toBeNull();
    });
  });
});
