import { buildReport, periodsBetween, resolveRange } from './report-builder';

const TODAY = '2026-11-04';

describe('periods', () => {
  it('lists ISO weeks between two dates inclusive', () => {
    expect(periodsBetween('2026-10-20', '2026-11-04', 'week')).toEqual(['2026-10-19', '2026-10-26', '2026-11-02']);
  });
  it('lists months between two dates inclusive', () => {
    expect(periodsBetween('2026-09-15', '2026-11-04', 'month')).toEqual(['2026-09', '2026-10', '2026-11']);
  });
  it('defaults to the last 12 weeks / months ending today', () => {
    expect(resolveRange(undefined, undefined, 'week', TODAY)).toEqual({ from: '2026-08-17', to: TODAY, explicit: false });
    expect(resolveRange(undefined, undefined, 'month', TODAY)).toEqual({ from: '2025-12-01', to: TODAY, explicit: false });
    expect(resolveRange('2026-01-01', '2026-02-01', 'week', TODAY)).toEqual({ from: '2026-01-01', to: '2026-02-01', explicit: true });
  });
});

describe('buildReport', () => {
  const t = (o: Partial<Parameters<typeof buildReport>[0]['tasks'][number]>) => ({
    id: Math.random().toString(), featureId: 'f1', productId: 'p1', assigneeId: 'u1', status: 'TODO' as const,
    deadline: null, completedLate: false, completedOn: null, createdOn: '2026-10-01', ...o,
  });
  const base = {
    products: [{ id: 'p1', name: 'Phantom R3' }, { id: 'p2', name: 'Veronica' }],
    features: [{ id: 'f1', name: 'Wi-Fi', category: 'Firmware', productId: 'p1', productName: 'Phantom R3' }],
    users: [{ id: 'u1', name: 'Lan' }],
    granularity: 'week' as const,
    today: TODAY,
  };

  it('summarises, buckets throughput by completion week and groups by product/feature/assignee', () => {
    const r = buildReport({
      ...base,
      from: undefined,
      to: undefined,
      tasks: [
        t({ status: 'COMPLETED', deadline: '2026-11-01', completedOn: '2026-11-03', completedLate: true }),
        t({ status: 'COMPLETED', deadline: '2026-11-10', completedOn: '2026-10-28' }),
        t({ status: 'IN_PROGRESS', deadline: '2026-10-01' }), // overdue
        t({ status: 'TODO', assigneeId: null }),
      ],
    });
    expect(r.summary).toEqual({ total: 4, completed: 2, open: 2, overdue: 1, completedLate: 1, completedOnTime: 1, onTimeRate: 1 / 3 });
    expect(r.throughput.slice(-2)).toEqual([
      { period: '2026-10-26', completed: 1, completedLate: 0 },
      { period: '2026-11-02', completed: 1, completedLate: 1 },
    ]);
    expect(r.throughput).toHaveLength(12);
    expect(r.products).toEqual([
      { productId: 'p1', name: 'Phantom R3', total: 4, completed: 2, overdue: 1, progress: 50 },
      { productId: 'p2', name: 'Veronica', total: 0, completed: 0, overdue: 0, progress: 0 },
    ]);
    expect(r.features[0]).toMatchObject({ featureId: 'f1', total: 4, progress: 50 });
    expect(r.workload).toEqual([
      { userId: 'u1', name: 'Lan', total: 3, open: 1, completed: 2, overdue: 1, completedLate: 1 },
      { userId: null, name: 'Unassigned', total: 1, open: 1, completed: 0, overdue: 0, completedLate: 0 },
    ]);
  });

  it('with an explicit range counts only tasks whose deadline falls inside it', () => {
    const r = buildReport({
      ...base,
      from: '2026-11-01',
      to: '2026-11-30',
      tasks: [t({ deadline: '2026-11-05' }), t({ deadline: '2026-10-05' }), t({ deadline: null })],
    });
    expect(r.summary.total).toBe(1);
    expect(r.range).toEqual({ from: '2026-11-01', to: '2026-11-30' });
  });
});
