import type { SwpRecordPage } from '../types/swp-events.ts';

export interface EventPageState<T> {
  records: T[];
  page: number;
  total: number | null;
  loading: boolean;
  hasNext: boolean;
  error: string | null;
  warning: string | null;
  syncedAt: string | null;
}

/** Read-only, one page at a time. Old scopes never publish into the current ward. */
export function createEventRecordBrowser<T extends { id: string }>(
  load: (page: number) => Promise<SwpRecordPage<T>>,
  publish: (state: EventPageState<T>) => void,
) {
  let generation = 0;
  let state: EventPageState<T> = empty();
  function empty(): EventPageState<T> {
    return { records: [], page: 0, total: null, loading: false, hasNext: false, error: null, warning: null, syncedAt: null };
  }
  function update(patch: Partial<EventPageState<T>>) {
    state = { ...state, ...patch };
    publish(state);
  }
  async function go(page: number): Promise<boolean> {
    if (state.loading || !Number.isSafeInteger(page) || page < 1)
      return false;
    const run = generation;
    update({ loading: true, error: null });
    try {
      const result = await load(page);
      if (run !== generation) return false;
      const { coverage } = result;
      if (coverage.current !== page)
        throw new Error('接口返回页码不一致，请刷新后重试');
      const records = [...new Map(result.records.map(item => [item.id, item])).values()];
      const hasNext = coverage.pages != null ? page < coverage.pages
        : coverage.total != null && coverage.size != null ? page * coverage.size < coverage.total
          : coverage.received >= (coverage.size ?? 200);
      if (!coverage.received && (hasNext || (page === 1 && (coverage.total ?? 0) > 0)))
        throw new Error('接口返回空页但总数仍有记录，请刷新后重试');
      if (page !== state.page && records.length && records.length === state.records.length
        && records.every(item => state.records.some(previous => previous.id === item.id)))
        throw new Error('接口重复返回上一页记录，请刷新后重试');
      const warnings = [
        coverage.received !== records.length ? `本页返回 ${coverage.received} 条，去重并排除非本病区或非未处理记录后展示 ${records.length} 条` : '',
        state.total != null && coverage.total !== state.total ? '后台记录数量发生变化，建议刷新第一页复核' : '',
      ];
      update({ records, page, total: coverage.total, hasNext, warning: warnings.filter(Boolean).join('；') || null, syncedAt: new Date().toISOString() });
      return true;
    }
    catch (error) {
      if (run === generation)
        update({ error: error instanceof Error ? error.message : '加载事件记录失败' });
      return false;
    }
    finally {
      if (run === generation) update({ loading: false });
    }
  }
  function reset() {
    generation += 1;
    state = empty();
    publish(state);
  }
  return { go, reset };
}
