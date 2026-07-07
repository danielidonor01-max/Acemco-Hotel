import { buildMeta, paginate, paginationSchema } from '../src/common/utils/pagination';

describe('pagination', () => {
  it('computes total pages (ceil, min 1)', () => {
    expect(buildMeta(0, 1, 20).totalPages).toBe(1);
    expect(buildMeta(20, 1, 20).totalPages).toBe(1);
    expect(buildMeta(21, 1, 20).totalPages).toBe(2);
    expect(buildMeta(100, 2, 20).totalPages).toBe(5);
  });

  it('wraps items with meta', () => {
    const res = paginate([{ id: 1 }], 1, 1, 20);
    expect(res.items).toHaveLength(1);
    expect(res.meta).toEqual({ total: 1, page: 1, pageSize: 20, totalPages: 1 });
  });

  it('coerces + defaults the query schema', () => {
    expect(paginationSchema.parse({})).toMatchObject({ page: 1, pageSize: 20, sortOrder: 'desc' });
    expect(paginationSchema.parse({ page: '3', pageSize: '50' })).toMatchObject({ page: 3, pageSize: 50 });
    expect(() => paginationSchema.parse({ pageSize: '500' })).toThrow();
  });
});
