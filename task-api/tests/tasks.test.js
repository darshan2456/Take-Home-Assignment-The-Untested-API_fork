const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

beforeEach(() => {
  taskService._reset();
});

//unit tests for taskService methods

describe('taskService - getByStatus', () => {
  test('returns tasks matching exact status', () => {
    taskService.create({ title: 'Task 1', status: 'todo' });
    taskService.create({ title: 'Task 2', status: 'in_progress' });
    const result = taskService.getByStatus('todo');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Task 1');
  });

  test('does not return tasks with status that merely contains the query string', () => {
    taskService.create({ title: 'Task 1', status: 'in_progress' });
    const result = taskService.getByStatus('in');
    expect(result).toHaveLength(0);
  });
});

describe('taskService - getPaginated', () => {
  beforeEach(() => {
    for (let i = 1; i <= 5; i++) {
      taskService.create({ title: `Task ${i}` });
    }
  });

  test('page 1 returns the first set of results', () => {
    const result = taskService.getPaginated(1, 2);
    expect(result[0].title).toBe('Task 1');
    expect(result).toHaveLength(2);
  });

  test('page 2 returns the next set of results', () => {
    const result = taskService.getPaginated(2, 2);
    expect(result[0].title).toBe('Task 3');
    expect(result).toHaveLength(2);
  });
});

describe('taskService - completeTask', () => {
  test('sets status to done and completedAt timestamp', () => {
    const task = taskService.create({ title: 'Task 1', priority: 'high' });
    const completed = taskService.completeTask(task.id);
    expect(completed.status).toBe('done');
    expect(completed.completedAt).not.toBeNull();
  });

  test('does not override the original priority', () => {
    const task = taskService.create({ title: 'Task 1', priority: 'high' });
    const completed = taskService.completeTask(task.id);
    expect(completed.priority).toBe('high');
  });

  test('returns null for non-existent task', () => {
    expect(taskService.completeTask('fake-id')).toBeNull();
  });
});

describe('taskService - create', () => {
  test('creates task with correct defaults', () => {
    const task = taskService.create({ title: 'Test Task' });
    expect(task.status).toBe('todo');
    expect(task.priority).toBe('medium');
    expect(task.completedAt).toBeNull();
    expect(task.dueDate).toBeNull();
    expect(task.id).toBeDefined();
  });

  test('assignee field is not present by default', () => {
    const task = taskService.create({ title: 'Test Task' });
    expect(task.assignee).toBeUndefined();
  });
});

describe('taskService - getStats', () => {
  test('counts tasks by status correctly', () => {
    taskService.create({ title: 'T1', status: 'todo' });
    taskService.create({ title: 'T2', status: 'todo' });
    taskService.create({ title: 'T3', status: 'in_progress' });
    const stats = taskService.getStats();
    expect(stats.todo).toBe(2);
    expect(stats.in_progress).toBe(1);
    expect(stats.done).toBe(0);
  });

  test('counts overdue tasks correctly', () => {
    taskService.create({ title: 'Overdue', status: 'todo', dueDate: '2020-01-01T00:00:00.000Z' });
    taskService.create({ title: 'Not overdue', status: 'todo', dueDate: '2099-01-01T00:00:00.000Z' });
    const stats = taskService.getStats();
    expect(stats.overdue).toBe(1);
  });

  test('does not count done tasks as overdue', () => {
    taskService.create({ title: 'Done overdue', status: 'done', dueDate: '2020-01-01T00:00:00.000Z' });
    const stats = taskService.getStats();
    expect(stats.overdue).toBe(0);
  });
});

//integration tests

describe('POST /tasks', () => {
  test('creates a task successfully', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'New Task', status: 'todo', priority: 'high' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('New Task');
  });

  test('returns 400 if title is missing', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ status: 'todo' });
    expect(res.status).toBe(400);
  });

  test('returns 400 for invalid status', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'Task', status: 'invalid_status' });
    expect(res.status).toBe(400);
  });

  test('returns 400 for invalid priority', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'Task', priority: 'urgent' });
    expect(res.status).toBe(400);
  });
});

describe('GET /tasks', () => {
  test('returns all tasks', async () => {
    taskService.create({ title: 'T1' });
    taskService.create({ title: 'T2' });
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('filters by status', async () => {
    taskService.create({ title: 'T1', status: 'todo' });
    taskService.create({ title: 'T2', status: 'done' });
    const res = await request(app).get('/tasks?status=todo');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  test('paginates correctly', async () => {
    for (let i = 1; i <= 5; i++) taskService.create({ title: `Task ${i}` });
    const res = await request(app).get('/tasks?page=1&limit=2');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toBe('Task 1');
  });
});

describe('PUT /tasks/:id', () => {
  test('updates a task', async () => {
    const task = taskService.create({ title: 'Old Title' });
    const res = await request(app)
      .put(`/tasks/${task.id}`)
      .send({ title: 'New Title' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New Title');
  });

  test('returns 404 for non-existent task', async () => {
    const res = await request(app)
      .put('/tasks/fake-id')
      .send({ title: 'New Title' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /tasks/:id', () => {
  test('deletes a task', async () => {
    const task = taskService.create({ title: 'To delete' });
    const res = await request(app).delete(`/tasks/${task.id}`);
    expect(res.status).toBe(204);
  });

  test('returns 404 for non-existent task', async () => {
    const res = await request(app).delete('/tasks/fake-id');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /tasks/:id/complete', () => {
  test('marks task as done', async () => {
    const task = taskService.create({ title: 'Task' });
    const res = await request(app).patch(`/tasks/${task.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(res.body.completedAt).not.toBeNull();
  });

  test('returns 404 for non-existent task', async () => {
    const res = await request(app).patch('/tasks/fake-id/complete');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /tasks/:id/assign', () => {
  test('assigns a task successfully', async () => {
    const task = taskService.create({ title: 'Task' });
    const res = await request(app)
      .patch(`/tasks/${task.id}/assign`)
      .send({ assignee: 'Darshan' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Darshan');
  });

  test('returns 400 for empty assignee string', async () => {
    const task = taskService.create({ title: 'Task' });
    const res = await request(app)
      .patch(`/tasks/${task.id}/assign`)
      .send({ assignee: '' });
    expect(res.status).toBe(400);
  });

  test('returns 400 if assignee is missing', async () => {
    const task = taskService.create({ title: 'Task' });
    const res = await request(app)
      .patch(`/tasks/${task.id}/assign`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('returns 404 for non-existent task', async () => {
    const res = await request(app)
      .patch('/tasks/fake-id/assign')
      .send({ assignee: 'Darshan' });
    expect(res.status).toBe(404);
  });

  test('trims whitespace from assignee name', async () => {
    const task = taskService.create({ title: 'Task' });
    const res = await request(app)
      .patch(`/tasks/${task.id}/assign`)
      .send({ assignee: '  Darshan  ' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Darshan');
  });
});

describe('GET /tasks/stats', () => {
  test('returns correct stats', async () => {
    taskService.create({ title: 'T1', status: 'todo' });
    taskService.create({ title: 'T2', status: 'done' });
    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body.todo).toBe(1);
    expect(res.body.done).toBe(1);
    expect(res.body.overdue).toBeDefined();
  });
});