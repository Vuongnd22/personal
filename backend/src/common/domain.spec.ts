import {
  canDeleteTask,
  canEditChecklist,
  canUpdateTaskFields,
  completionPatch,
  effectiveStatus,
  isOverdue,
  monthKey,
  onTimeRate,
  partition,
  progressPercent,
  validateDiagram,
  weekStart,
} from './domain';

const TODAY = '2026-11-04';

describe('overdue', () => {
  it('is overdue when open and deadline before today', () => {
    expect(isOverdue('IN_PROGRESS', '2026-11-03', TODAY)).toBe(true);
  });
  it('is not overdue on the deadline day itself', () => {
    expect(isOverdue('TODO', TODAY, TODAY)).toBe(false);
  });
  it('is never overdue when completed or without deadline', () => {
    expect(isOverdue('COMPLETED', '2026-01-01', TODAY)).toBe(false);
    expect(isOverdue('TODO', null, TODAY)).toBe(false);
  });
  it('effectiveStatus reports OVERDUE only for overdue tasks', () => {
    expect(effectiveStatus('REVIEW', '2026-10-01', TODAY)).toBe('OVERDUE');
    expect(effectiveStatus('REVIEW', '2026-12-01', TODAY)).toBe('REVIEW');
  });
});

describe('completionPatch', () => {
  const now = new Date('2026-11-04T03:00:00Z');
  it('marks completion on time', () => {
    expect(completionPatch('IN_PROGRESS', 'COMPLETED', '2026-11-04', TODAY, now)).toEqual({
      completedAt: now,
      completedLate: false,
    });
  });
  it('marks completion late when today is after the deadline', () => {
    expect(completionPatch('TODO', 'COMPLETED', '2026-11-01', TODAY, now)).toEqual({
      completedAt: now,
      completedLate: true,
    });
  });
  it('clears completion when reopened', () => {
    expect(completionPatch('COMPLETED', 'IN_PROGRESS', '2026-11-01', TODAY, now)).toEqual({
      completedAt: null,
      completedLate: false,
    });
  });
  it('changes nothing for transitions between open statuses', () => {
    expect(completionPatch('TODO', 'REVIEW', null, TODAY, now)).toEqual({});
    expect(completionPatch('COMPLETED', 'COMPLETED', null, TODAY, now)).toEqual({});
  });
});

describe('partition and rates', () => {
  const tasks = [
    { status: 'TODO' as const, deadline: null, completedLate: false },
    { status: 'TODO' as const, deadline: '2026-11-01', completedLate: false }, // overdue
    { status: 'IN_PROGRESS' as const, deadline: '2026-12-01', completedLate: false },
    { status: 'REVIEW' as const, deadline: '2026-10-01', completedLate: false }, // overdue
    { status: 'COMPLETED' as const, deadline: '2026-10-01', completedLate: true },
    { status: 'COMPLETED' as const, deadline: '2026-11-10', completedLate: false },
    { status: 'COMPLETED' as const, deadline: null, completedLate: false },
  ];

  it('partitions into disjoint buckets that sum to total', () => {
    const p = partition(tasks, TODAY);
    expect(p).toEqual({
      total: 7,
      todo: 1,
      inProgress: 1,
      review: 0,
      completed: 3,
      overdue: 2,
      completedLate: 1,
      completedOnTime: 1,
      completedWithDeadline: 2,
    });
    expect(p.todo + p.inProgress + p.review + p.completed + p.overdue).toBe(p.total);
  });

  it('computes on-time rate over due work, null when nothing is due', () => {
    expect(onTimeRate(partition(tasks, TODAY))).toBeCloseTo(1 / 4);
    expect(onTimeRate(partition([], TODAY))).toBeNull();
  });

  it('rounds progress and handles zero', () => {
    expect(progressPercent(1, 3)).toBe(33);
    expect(progressPercent(2, 3)).toBe(67);
    expect(progressPercent(0, 0)).toBe(0);
  });
});

describe('periods', () => {
  it('weekStart returns the Monday of the ISO week', () => {
    expect(weekStart('2026-11-04')).toBe('2026-11-02'); // Wednesday
    expect(weekStart('2026-11-08')).toBe('2026-11-02'); // Sunday
    expect(weekStart('2026-11-02')).toBe('2026-11-02');
  });
  it('monthKey returns YYYY-MM', () => {
    expect(monthKey('2026-11-04')).toBe('2026-11');
  });
});

describe('task permissions', () => {
  const task = { creatorId: 'c', assigneeId: 'a' };
  const member = (id: string) => ({ id, role: 'MEMBER' as const });

  it('managers and admins can do everything', () => {
    expect(canUpdateTaskFields({ id: 'x', role: 'MANAGER' }, task, ['title', 'deadline'])).toBe(true);
    expect(canDeleteTask({ id: 'x', role: 'ADMIN' }, task)).toBe(true);
  });
  it('the creator may edit any field and delete', () => {
    expect(canUpdateTaskFields(member('c'), task, ['title', 'assigneeId'])).toBe(true);
    expect(canDeleteTask(member('c'), task)).toBe(true);
  });
  it('the assignee may only change status and order', () => {
    expect(canUpdateTaskFields(member('a'), task, ['status', 'sortOrder'])).toBe(true);
    expect(canUpdateTaskFields(member('a'), task, ['status', 'title'])).toBe(false);
    expect(canDeleteTask(member('a'), task)).toBe(false);
    expect(canEditChecklist(member('a'), task)).toBe(true);
  });
  it('other members can do nothing', () => {
    expect(canUpdateTaskFields(member('z'), task, ['status'])).toBe(false);
    expect(canEditChecklist(member('z'), task)).toBe(false);
  });
});

describe('validateDiagram', () => {
  const node = (id: string, extra: object = {}) => ({ id, kind: 'MODULE' as const, refProductId: null, isCenter: false, ...extra });

  it('accepts a valid diagram', () => {
    expect(
      validateDiagram({
        nodes: [node('a', { isCenter: true, kind: 'PRODUCT', refProductId: 'p1' }), node('b')],
        connections: [{ id: 'e', sourceNodeId: 'a', targetNodeId: 'b' }],
      }),
    ).toEqual([]);
  });

  it('reports every structural problem', () => {
    const errors = validateDiagram({
      nodes: [
        node('a', { isCenter: true, kind: 'PRODUCT', refProductId: 'p1' }),
        node('b', { isCenter: true, kind: 'PRODUCT', refProductId: 'p1' }),
        node('a'),
        node('c', { kind: 'PRODUCT', refProductId: null }),
      ],
      connections: [
        { id: 'e1', sourceNodeId: 'a', targetNodeId: 'missing' },
        { id: 'e2', sourceNodeId: 'b', targetNodeId: 'b' },
      ],
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/duplicate node id/i),
        expect.stringMatching(/more than one center/i),
        expect.stringMatching(/appears more than once/i),
        expect.stringMatching(/requires refProductId/i),
        expect.stringMatching(/unknown node/i),
        expect.stringMatching(/self-loop/i),
      ]),
    );
  });
});
