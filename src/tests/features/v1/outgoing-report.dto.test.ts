import { validateSync } from 'class-validator';
import { OutgoingReportListDto } from '@/features/v1/outgoing-report/dtos';

const make = (over: Record<string, any> = {}) =>
  Object.assign(new OutgoingReportListDto(), {
    startDate: '2026-09-01',
    endDate: '2026-09-15',
    ...over,
  });

/** Trust boundary: tanggal wajib & format YYYY-MM-DD, order/sort di-whitelist */
describe('OutgoingReportListDto', () => {
  it('valid dengan hanya startDate/endDate', () => {
    expect(validateSync(make())).toHaveLength(0);
  });

  it('tolak tanpa startDate, tanpa endDate, atau format salah', () => {
    expect(validateSync(make({ startDate: undefined }))).not.toHaveLength(0);
    expect(validateSync(make({ endDate: undefined }))).not.toHaveLength(0);
    expect(validateSync(make({ startDate: '15/09/2026' }))).not.toHaveLength(
      0,
    );
  });

  it('tolak order/searchBy/sort di luar whitelist', () => {
    expect(validateSync(make({ order: 'noSuchColumn' }))).not.toHaveLength(0);
    expect(validateSync(make({ searchBy: 'poNo' }))).not.toHaveLength(0);
    expect(validateSync(make({ sort: 'DESC' }))).not.toHaveLength(0);
  });
});
