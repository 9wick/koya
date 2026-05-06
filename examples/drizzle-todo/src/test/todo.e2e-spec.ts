import { existsSync, rmSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';

import { app } from '../app';

const fetch = (input: RequestInfo | URL, init?: RequestInit) => app.fetch(new Request(input, init));

const baseUrl = 'https://example.local';

describe('TodoController (e2e)', () => {
  afterAll(() => {
    if (existsSync('./data/todo.db')) {
      rmSync('./data/todo.db');
    }
  });

  it('POST /todos - create a todo', async () => {
    const res = await fetch(`${baseUrl}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Buy milk' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      id: expect.any(Number),
      title: 'Buy milk',
      completed: false,
    });
  });

  it('GET /todos - list all todos', async () => {
    const res = await fetch(`${baseUrl}/todos`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it('GET /todos/:id - get a todo by id', async () => {
    const createRes = await fetch(`${baseUrl}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test todo' }),
    });
    const created = await createRes.json();

    const res = await fetch(`${baseUrl}/todos/${created.id}`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Test todo');
  });

  it('GET /todos/:id - return 404 for non-existent todo', async () => {
    const res = await fetch(`${baseUrl}/todos/99999`);

    expect(res.status).toBe(404);
  });

  it('PATCH /todos/:id - update a todo', async () => {
    const createRes = await fetch(`${baseUrl}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Original title' }),
    });
    const created = await createRes.json();

    const res = await fetch(`${baseUrl}/todos/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated title', completed: true }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Updated title');
    expect(body.completed).toBe(true);
  });

  it('DELETE /todos/:id - delete a todo', async () => {
    const createRes = await fetch(`${baseUrl}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'To be deleted' }),
    });
    const created = await createRes.json();

    const res = await fetch(`${baseUrl}/todos/${created.id}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(204);

    const getRes = await fetch(`${baseUrl}/todos/${created.id}`);
    expect(getRes.status).toBe(404);
  });
});
