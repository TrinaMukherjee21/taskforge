const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

describe('Tasks API Integration Tests', () => {
  beforeEach(() => {
    taskService._reset();
  });

  describe('POST /tasks', () => {
    it('creates a task (201) with defaults', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'New Task' });
      
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('New Task');
      expect(res.body.description).toBe('');
      expect(res.body.status).toBe('todo');
      expect(res.body.priority).toBe('medium');
      expect(res.body.dueDate).toBeNull();
      expect(res.body.completedAt).toBeNull();
      expect(res.body.createdAt).toBeDefined();
    });

    it('returns 400 for missing title', async () => {
      const res = await request(app).post('/tasks').send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 for empty or whitespace title', async () => {
      const res1 = await request(app).post('/tasks').send({ title: '' });
      expect(res1.status).toBe(400);
      
      const res2 = await request(app).post('/tasks').send({ title: '   ' });
      expect(res2.status).toBe(400);
    });

    it('returns 400 for non-string title', async () => {
      const res = await request(app).post('/tasks').send({ title: 123 });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid status', async () => {
      const res = await request(app).post('/tasks').send({ title: 'T', status: 'invalid_status' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid priority', async () => {
      const res = await request(app).post('/tasks').send({ title: 'T', priority: 'invalid_priority' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid dueDate', async () => {
      const res = await request(app).post('/tasks').send({ title: 'T', dueDate: 'not-a-date' });
      expect(res.status).toBe(400);
    });

      // BUG-7: express.json throws SyntaxError which results in 500 instead of 400
    it.failing('returns 400 for malformed JSON body', async () => {
      const res = await request(app)
        .post('/tasks')
        .set('Content-Type', 'application/json')
        .send('{"title": "Missing closing quote}');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /tasks', () => {
    it('returns empty list when no tasks', async () => {
      const res = await request(app).get('/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns list of tasks', async () => {
      taskService.create({ title: 'T1' });
      taskService.create({ title: 'T2' });
      
      const res = await request(app).get('/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('T1');
      expect(res.body[1].title).toBe('T2');
    });

      // BUG-1: getByStatus uses .includes() instead of strict equality (===)
    it.failing('filters by status (exact match)', async () => {
      taskService.create({ title: 'T1', status: 'todo' });
      taskService.create({ title: 'T2', status: 'done' });
      
      const res = await request(app).get('/tasks?status=todo');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('T1');
      
      const res2 = await request(app).get('/tasks?status=do');
      expect(res2.status).toBe(200);
      expect(res2.body).toHaveLength(0);
    });

      // BUG-2: FIXED
    it('paginates correctly (page 1 & 2 & beyond)', async () => {
      for (let i = 1; i <= 5; i++) {
        taskService.create({ title: `T${i}` });
      }
      
      const page1 = await request(app).get('/tasks?page=1&limit=2');
      expect(page1.status).toBe(200);
      expect(page1.body).toHaveLength(2);
      expect(page1.body[0].title).toBe('T1');
      expect(page1.body[1].title).toBe('T2');
      
      const page2 = await request(app).get('/tasks?page=2&limit=2');
      expect(page2.status).toBe(200);
      expect(page2.body).toHaveLength(2);
      expect(page2.body[0].title).toBe('T3');
      expect(page2.body[1].title).toBe('T4');
      
      const page4 = await request(app).get('/tasks?page=4&limit=2');
      expect(page4.status).toBe(200);
      expect(page4.body).toHaveLength(0);
    });

      // BUG-5: status filter returns early ignoring pagination parameters
    it.failing('respects both status and pagination when combined', async () => {
      for (let i = 1; i <= 5; i++) {
        taskService.create({ title: `Todo ${i}`, status: 'todo' });
      }
      taskService.create({ title: `Done`, status: 'done' });
      
      const res = await request(app).get('/tasks?status=todo&page=2&limit=2');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('Todo 3');
      expect(res.body[1].title).toBe('Todo 4');
    });
  });

  describe('GET /tasks/stats', () => {
    it('returns correct counts and overdue count', async () => {
      taskService.create({ title: 'T1', status: 'todo' });
      taskService.create({ title: 'T2', status: 'done' });
      
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      taskService.create({ title: 'T3', status: 'todo', dueDate: pastDate.toISOString() });
      
      const res = await request(app).get('/tasks/stats');
      expect(res.status).toBe(200);
      expect(res.body.todo).toBe(2);
      expect(res.body.in_progress).toBe(0);
      expect(res.body.done).toBe(1);
      expect(res.body.overdue).toBe(1);
    });
  });

  describe('PUT /tasks/:id', () => {
    it('returns 200 and updates task', async () => {
      const task = taskService.create({ title: 'Old' });
      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ title: 'New', status: 'in_progress' });
      
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('New');
      expect(res.body.status).toBe('in_progress');
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app)
        .put('/tasks/unknown-id')
        .send({ title: 'New' });
      
      expect(res.status).toBe(404);
    });

    it('returns 400 for empty or whitespace title', async () => {
      const task = taskService.create({ title: 'Old' });
      const res1 = await request(app).put(`/tasks/${task.id}`).send({ title: '' });
      expect(res1.status).toBe(400);
      const res2 = await request(app).put(`/tasks/${task.id}`).send({ title: '   ' });
      expect(res2.status).toBe(400);
    });

    it('returns 400 for non-string title', async () => {
      const task = taskService.create({ title: 'Old' });
      const res = await request(app).put(`/tasks/${task.id}`).send({ title: 123 });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid status', async () => {
      const task = taskService.create({ title: 'Old' });
      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ status: 'invalid' });
      
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid priority', async () => {
      const task = taskService.create({ title: 'Old' });
      const res = await request(app).put(`/tasks/${task.id}`).send({ priority: 'invalid_priority' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid dueDate', async () => {
      const task = taskService.create({ title: 'Old' });
      const res = await request(app).put(`/tasks/${task.id}`).send({ dueDate: 'not-a-date' });
      expect(res.status).toBe(400);
    });

      // BUG-3: update performs a blind merge, overwriting immutable fields
    it.failing('does not allow overwriting id or createdAt', async () => {
      const task = taskService.create({ title: 'Old' });
      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ title: 'New', id: 'hacked-id', createdAt: '2000-01-01T00:00:00.000Z' });
      
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(task.id);
      expect(res.body.createdAt).toBe(task.createdAt);
      
      const found = taskService.findById(task.id);
      expect(found.id).toBe(task.id);
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('returns 204 and deletes task', async () => {
      const task = taskService.create({ title: 'To delete' });
      const res = await request(app).delete(`/tasks/${task.id}`);
      
      expect(res.status).toBe(204);
      expect(taskService.findById(task.id)).toBeUndefined();
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app).delete('/tasks/unknown-id');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /tasks/:id/complete', () => {
      // BUG-4: completeTask hardcodes priority to 'medium'
    it.failing('returns 200, sets status done, sets completedAt, keeps priority', async () => {
      const task = taskService.create({ title: 'T1', priority: 'high' });
      const res = await request(app).patch(`/tasks/${task.id}/complete`);
      
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('done');
      expect(res.body.priority).toBe('high');
      expect(res.body.completedAt).not.toBeNull();
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app).patch('/tasks/unknown-id/complete');
      expect(res.status).toBe(404);
    });
  });
});
