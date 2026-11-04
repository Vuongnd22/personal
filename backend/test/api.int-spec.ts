// Runs on node:test (NestJS 12 ships ESM, which Jest cannot require); assertions use Jest's `expect`.
import { after as afterAll, before as beforeAll, describe, it } from 'node:test';
import { expect } from 'expect';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/main';
import { Clock, FixedClock } from '../src/common/clock/clock';
import { PrismaService } from '../src/prisma/prisma.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const startTestDatabase: () => Promise<() => Promise<void>> = require('./test-db.js');

// "Today" is 2026-06-15 in Asia/Ho_Chi_Minh for every test.
const TODAY = '2026-06-15';
const YESTERDAY = '2026-06-14';
const NEXT_WEEK = '2026-06-22';

describe('ArchBoard API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const agents: Record<'admin' | 'manager' | 'member' | 'other', ReturnType<typeof request.agent>> = {} as never;
  const ids: Record<string, string> = {};

  let stopDb: () => Promise<void>;

  beforeAll(async () => {
    stopDb = await startTestDatabase();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Clock)
      .useValue(new FixedClock(new Date('2026-06-15T05:00:00Z')))
      .compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.$executeRawUnsafe(
      'TRUNCATE notifications, architecture_connections, architecture_nodes, task_history, task_attachments, task_comments, task_checklists, tasks, features, products, users CASCADE',
    );
    const passwordHash = await bcrypt.hash('Passw0rd!', 4);
    for (const [key, role] of [['admin', 'ADMIN'], ['manager', 'MANAGER'], ['member', 'MEMBER'], ['other', 'MEMBER']] as const) {
      const u = await prisma.user.create({ data: { email: `${key}@test.local`, name: `User ${key}`, role, passwordHash } });
      ids[key] = u.id;
      agents[key] = request.agent(app.getHttpServer());
      await agents[key].post('/api/auth/login').send({ email: `${key}@test.local`, password: 'Passw0rd!' }).expect(200);
    }
  });

  afterAll(async () => {
    await app?.close();
    await stopDb?.();
  });

  const createProduct = async (name = `P-${randomUUID().slice(0, 8)}`) =>
    (await agents.manager.post('/api/products').send({ name }).expect(201)).body;
  const createFeature = async (productId: string, name = 'Wi-Fi Communication') =>
    (await agents.manager.post(`/api/products/${productId}/features`).send({ name, category: 'Firmware' }).expect(201)).body;
  const createTask = async (featureId: string, extra: object = {}) =>
    (await agents.manager.post('/api/tasks').send({ featureId, title: 'Tối ưu kết nối Wi-Fi', ...extra }).expect(201)).body;

  describe('auth', () => {
    it('rejects unauthenticated requests and bad passwords', async () => {
      await request(app.getHttpServer()).get('/api/dashboard').expect(401);
      await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'admin@test.local', password: 'nope' }).expect(401);
    });

    it('returns the current user from the session cookie and logs out', async () => {
      const agent = request.agent(app.getHttpServer());
      const login = await agent.post('/api/auth/login').send({ email: 'admin@test.local', password: 'Passw0rd!' }).expect(200);
      expect(login.headers['set-cookie'][0]).toMatch(/ab_token=.*HttpOnly/i);
      expect((await agent.get('/api/auth/me').expect(200)).body).toMatchObject({ email: 'admin@test.local', role: 'ADMIN' });
      await agent.post('/api/auth/logout').expect(200);
      await agent.get('/api/auth/me').expect(401);
    });
  });

  describe('products', () => {
    it('CRUD with validation, unique names, search and progress sort', async () => {
      const res = await agents.manager.post('/api/products').send({ name: '', deadline: 'tomorrow' }).expect(400);
      expect(res.body.errors.map((e: { field: string }) => e.field).sort()).toEqual(['deadline', 'name']);

      const p = await createProduct('Phantom R3 Test');
      expect(p).toMatchObject({ name: 'Phantom R3 Test', taskCount: 0, progress: 0, featureCount: 0, owner: null });
      await agents.manager.post('/api/products').send({ name: 'Phantom R3 Test' }).expect(409);

      const updated = (await agents.manager.patch(`/api/products/${p.id}`).send({ status: 'ON_HOLD', deadline: NEXT_WEEK }).expect(200)).body;
      expect(updated).toMatchObject({ status: 'ON_HOLD', deadline: NEXT_WEEK });
      const cleared = (await agents.manager.patch(`/api/products/${p.id}`).send({ deadline: null }).expect(200)).body;
      expect(cleared.deadline).toBeNull();

      const found = (await agents.member.get('/api/products?search=phantom r3 t').expect(200)).body;
      expect(found.map((x: { id: string }) => x.id)).toContain(p.id);

      await agents.manager.delete(`/api/products/${p.id}`).expect(200);
      await agents.manager.get(`/api/products/${p.id}`).expect(404);
    });

    it('forbids members from managing products and features', async () => {
      await agents.member.post('/api/products').send({ name: 'Nope' }).expect(403);
      const p = await createProduct();
      await agents.member.patch(`/api/products/${p.id}`).send({ name: 'x' }).expect(403);
      await agents.member.post(`/api/products/${p.id}/features`).send({ name: 'x' }).expect(403);
    });
  });

  describe('tasks, progress and overdue', () => {
    it('derives overdue from the deadline and freezes completedLate', async () => {
      const p = await createProduct();
      const f = await createFeature(p.id);
      const t = await createTask(f.id, { deadline: NEXT_WEEK, assigneeId: ids.member });
      expect(t).toMatchObject({ status: 'TODO', effectiveStatus: 'TODO', isOverdue: false, product: { id: p.id } });

      const moved = (await agents.manager.patch(`/api/tasks/${t.id}`).send({ deadline: YESTERDAY }).expect(200)).body;
      expect(moved).toMatchObject({ isOverdue: true, effectiveStatus: 'OVERDUE' });
      const overdue = (await agents.member.get(`/api/tasks?productId=${p.id}&status=OVERDUE`).expect(200)).body;
      expect(overdue.items.map((x: { id: string }) => x.id)).toEqual([t.id]);
      expect((await agents.member.get(`/api/tasks?productId=${p.id}&status=TODO`).expect(200)).body.total).toBe(0);

      const dueToday = (await agents.manager.patch(`/api/tasks/${t.id}`).send({ deadline: TODAY }).expect(200)).body;
      expect(dueToday.isOverdue).toBe(false);

      await agents.manager.patch(`/api/tasks/${t.id}`).send({ deadline: YESTERDAY }).expect(200);
      const done = (await agents.member.patch(`/api/tasks/${t.id}`).send({ status: 'COMPLETED' }).expect(200)).body;
      expect(done).toMatchObject({ status: 'COMPLETED', isOverdue: false, completedLate: true });
      expect(done.completedAt).toBeTruthy();

      const later = (await agents.manager.patch(`/api/tasks/${t.id}`).send({ deadline: NEXT_WEEK }).expect(200)).body;
      expect(later.completedLate).toBe(true); // frozen at completion time

      const reopened = (await agents.manager.patch(`/api/tasks/${t.id}`).send({ status: 'IN_PROGRESS' }).expect(200)).body;
      expect(reopened).toMatchObject({ completedAt: null, completedLate: false });

      const history = (await agents.member.get(`/api/tasks/${t.id}/history`).expect(200)).body;
      expect(history.map((h: { field: string | null }) => h.field)).toEqual(expect.arrayContaining(['deadline', 'status']));
      expect(history.at(-1).action).toBe('CREATED');
    });

    it('recomputes feature, product and dashboard numbers after every change', async () => {
      const before = (await agents.admin.get('/api/dashboard').expect(200)).body.totals;
      const p = await createProduct();
      const f = await createFeature(p.id);
      const [a, b] = [await createTask(f.id), await createTask(f.id, { deadline: YESTERDAY })];

      let feature = (await agents.member.get(`/api/features/${f.id}`).expect(200)).body;
      expect(feature).toMatchObject({ taskCount: 2, completedCount: 0, overdueCount: 1, progress: 0 });
      const mid = (await agents.admin.get('/api/dashboard').expect(200)).body.totals;
      expect(mid.tasks - before.tasks).toBe(2);
      expect(mid.overdue - before.overdue).toBe(1);
      expect(mid.todo + mid.inProgress + mid.review + mid.completed + mid.overdue).toBe(mid.tasks);

      await agents.manager.patch(`/api/tasks/${a.id}`).send({ status: 'COMPLETED' }).expect(200);
      feature = (await agents.member.get(`/api/features/${f.id}`).expect(200)).body;
      expect(feature.progress).toBe(50);
      await agents.manager.patch(`/api/tasks/${b.id}`).send({ status: 'COMPLETED' }).expect(200);
      const product = (await agents.member.get(`/api/products/${p.id}`).expect(200)).body;
      expect(product).toMatchObject({ taskCount: 2, completedCount: 2, overdueCount: 0, progress: 100, featureCount: 1 });

      const features = (await agents.member.get(`/api/products/${p.id}/features`).expect(200)).body;
      expect(features[0]).toMatchObject({ id: f.id, progress: 100 });

      await agents.manager.delete(`/api/features/${f.id}`).expect(200);
      expect((await agents.member.get(`/api/tasks?productId=${p.id}`).expect(200)).body.total).toBe(0);
    });

    it('enforces member task permissions', async () => {
      const p = await createProduct();
      const f = await createFeature(p.id);
      const assigned = await createTask(f.id, { assigneeId: ids.member });

      await agents.member.patch(`/api/tasks/${assigned.id}`).send({ status: 'IN_PROGRESS' }).expect(200);
      await agents.member.patch(`/api/tasks/${assigned.id}`).send({ title: 'renamed' }).expect(403);
      await agents.member.delete(`/api/tasks/${assigned.id}`).expect(403);
      await agents.other.patch(`/api/tasks/${assigned.id}`).send({ status: 'REVIEW' }).expect(403);

      const own = (await agents.member.post('/api/tasks').send({ featureId: f.id, title: 'Mine' }).expect(201)).body;
      expect(own.creator.id).toBe(ids.member);
      await agents.member.patch(`/api/tasks/${own.id}`).send({ title: 'Mine 2', deadline: NEXT_WEEK }).expect(200);
      await agents.member.delete(`/api/tasks/${own.id}`).expect(200);
    });

    it('supports checklist, comments, attachments and notifications', async () => {
      const p = await createProduct();
      const f = await createFeature(p.id);
      const t = await createTask(f.id, { assigneeId: ids.member });

      const inbox = (await agents.member.get('/api/notifications?unread=true').expect(200)).body;
      expect(inbox.items.find((n: { taskId: string }) => n.taskId === t.id)).toMatchObject({ type: 'TASK_ASSIGNED' });

      const item = (await agents.member.post(`/api/tasks/${t.id}/checklist`).send({ title: 'Đo RSSI' }).expect(201)).body;
      await agents.member.patch(`/api/checklist/${item.id}`).send({ done: true }).expect(200);
      expect((await agents.member.get(`/api/tasks/${t.id}`).expect(200)).body).toMatchObject({
        checklist: { done: 1, total: 1 },
        checklistItems: [{ title: 'Đo RSSI', done: true }],
      });
      await agents.other.post(`/api/tasks/${t.id}/checklist`).send({ title: 'x' }).expect(403);

      const comment = (await agents.other.post(`/api/tasks/${t.id}/comments`).send({ body: 'Kết quả tốt' }).expect(201)).body;
      await agents.member.patch(`/api/comments/${comment.id}`).send({ body: 'hijack' }).expect(403);
      expect((await agents.manager.get(`/api/tasks/${t.id}/comments`).expect(200)).body).toHaveLength(1);

      const up = await agents.member
        .post(`/api/tasks/${t.id}/attachments`)
        .attach('file', Buffer.from('log data'), 'báo cáo.txt')
        .expect(201);
      expect(up.body).toMatchObject({ fileName: 'báo cáo.txt', size: 8 });
      const dl = await agents.manager.get(`/api/attachments/${up.body.id}/download`).expect(200);
      expect(dl.headers['content-disposition']).toContain("filename*=UTF-8''b%C3%A1o%20c%C3%A1o.txt");
      expect((await agents.member.get(`/api/tasks/${t.id}`)).body.attachmentCount).toBe(1);
      await agents.member.delete(`/api/attachments/${up.body.id}`).expect(200);
    });
  });

  describe('architecture', () => {
    it('offers an unsaved center node, saves the whole diagram and rejects stale or invalid saves', async () => {
      const p = await createProduct();
      const other = await createProduct();
      const initial = (await agents.member.get(`/api/products/${p.id}/architecture`).expect(200)).body;
      expect(initial.updatedAt).toBeNull();
      expect(initial.nodes).toEqual([expect.objectContaining({ kind: 'PRODUCT', refProductId: p.id, isCenter: true, label: p.name })]);

      const [c, o, m] = [initial.nodes[0].id, randomUUID(), randomUUID()];
      const body = {
        baseUpdatedAt: null,
        nodes: [
          { id: c, kind: 'PRODUCT', refProductId: p.id, isCenter: true, position: { x: 0, y: 0 } },
          { id: o, kind: 'PRODUCT', refProductId: other.id, position: { x: 300, y: -120 } },
          { id: m, kind: 'MODULE', label: 'PhantomR3A', position: { x: -250, y: 80 } },
        ],
        connections: [
          { id: randomUUID(), sourceNodeId: c, targetNodeId: o, label: 'Wav', direction: 'BOTH', sourceHandle: 'right', targetHandle: 'left' },
          { id: randomUUID(), sourceNodeId: m, targetNodeId: c },
        ],
      };
      await agents.member.put(`/api/products/${p.id}/architecture`).send(body).expect(403);
      const saved = (await agents.manager.put(`/api/products/${p.id}/architecture`).send(body).expect(200)).body;
      expect(saved.updatedAt).toBeTruthy();
      expect(saved.nodes).toHaveLength(3);
      expect(saved.nodes.find((n: { id: string }) => n.id === o)).toMatchObject({ label: other.name, position: { x: 300, y: -120 }, refProduct: { id: other.id, progress: 0 } });
      expect(saved.connections.find((e: { label: string }) => e.label === 'Wav')).toMatchObject({ direction: 'BOTH', sourceHandle: 'right' });

      const reloaded = (await agents.member.get(`/api/products/${p.id}/architecture`).expect(200)).body;
      expect(reloaded).toEqual(saved);

      await agents.manager.put(`/api/products/${p.id}/architecture`).send(body).expect(409);
      const loop = { ...body, baseUpdatedAt: saved.updatedAt, connections: [{ id: randomUUID(), sourceNodeId: c, targetNodeId: c }] };
      const bad = await agents.manager.put(`/api/products/${p.id}/architecture`).send(loop).expect(400);
      expect(bad.body.errors[0].message).toMatch(/self-loop/);

      await agents.manager.delete(`/api/products/${other.id}`).expect(200);
      const afterDelete = (await agents.member.get(`/api/products/${p.id}/architecture`).expect(200)).body;
      expect(afterDelete.nodes).toHaveLength(2);
      expect(afterDelete.connections).toHaveLength(1);
    });
  });

  describe('reports', () => {
    it('returns report sections and exports xlsx and pdf files', async () => {
      const report = (await agents.member.get('/api/reports?granularity=month').expect(200)).body;
      expect(Object.keys(report)).toEqual(['range', 'summary', 'throughput', 'products', 'features', 'workload']);
      expect(report.throughput).toHaveLength(12);

      const xlsx = await agents.member.get('/api/reports/export?format=xlsx').buffer(true).expect(200);
      expect(xlsx.headers['content-type']).toContain('spreadsheetml');
      expect(xlsx.headers['content-disposition']).toBe(`attachment; filename="archboard-report-${TODAY}.xlsx"`);
      const pdf = await agents.member.get('/api/reports/export?format=pdf').buffer(true).expect(200);
      expect(pdf.headers['content-type']).toBe('application/pdf');
      await agents.member.get('/api/reports/export?format=doc').expect(400);
    });
  });
});
