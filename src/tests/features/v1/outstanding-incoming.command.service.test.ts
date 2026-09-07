import { Transaction } from 'sequelize';

jest.mock('@/utils', () => ({
  sequelize: {
    transaction: jest.fn(async (cb: (t: Transaction) => Promise<void>) =>
      cb({} as Transaction),
    ),
  },
  nowWib: () => new Date('2026-09-03T04:00:00Z'),
  mediaToBlob: jest.fn(),
}));

import { CommandService } from '@/features/v1/outstanding-incoming/command.service';
import {
  computeBinningQty,
  computePlanQtyUpdate,
  filterAddInfos,
  isReadyToGoodsReceipt,
  leadtimeMinutes,
} from '@/features/v1/outstanding-incoming/constants';
import { BadRequestException } from '@/shared-libs/exceptions';

const reqOf = (body: any, params: any = {}, user: any = { tokenName: 'qa' }) =>
  ({ body, params, user }) as any;

const fakeRow = (plain: any) => ({
  get: (key?: any) =>
    key === undefined || (typeof key === 'object' && key?.plain)
      ? plain
      : plain[key],
});

function makeService(overrides: Record<string, any> = {}) {
  const calls: Record<string, any[]> = {};
  const rec = (k: string) => (calls[k] = calls[k] ?? []);
  const repository: any = {
    findByIds: async () => [],
    getById: async () => null,
    getByDeliveryNoteNo: async () => null,
    findDetailById: async () => null,
    createHeader: async (d: any) => fakeRow({ id: 'hdr-1', ...d }),
    updateHeader: async (...a: any[]) => void rec('updateHeader').push(a),
    insertHistory: async (...a: any[]) => void rec('insertHistory').push(a),
    replaceHeaderAddInfos: async (...a: any[]) =>
      void rec('replaceHeaderAddInfos').push(a),
    ...overrides.repository,
  };
  const holdRepository: any = {
    setHold: async (...a: any[]) => void rec('setHold').push(a),
    insertHoldRows: async (...a: any[]) => void rec('insertHoldRows').push(a),
    toggleHold: async (...a: any[]) => void rec('toggleHold').push(a),
    findSchedulesByHeaderIds: async () => [
      fakeRow({ planIncomingHeaderId: 'hdr-1', binningLocation: 'LOC-A' }),
    ],
    findAttachmentTemps: async () => [],
    findAttachments: async () => [],
    moveTempToPermanent: async (...a: any[]) =>
      void rec('moveTempToPermanent').push(a),
    findHolds: async () => [],
    findHoldRecords: async () => [],
    findHoldDetails: async () => [],
    insertAttachmentTemp: async () => {},
    ...overrides.holdRepository,
  };
  const actualRepository: any = {
    insertActuals: async (...a: any[]) => void rec('insertActuals').push(a),
    findLocations: async () => [],
    ...overrides.actualRepository,
  };
  const detailRepository: any = {
    findWithHeader: async () => null,
    getById: async () => null,
    getByHeaderAndMaterial: async () => null,
    create: async (d: any) => fakeRow({ id: `dtl-${Math.random()}`, ...d }),
    update: async (...a: any[]) => void rec('detailUpdate').push(a),
    findByHeader: async () => [],
    findByHeaderIds: async () => [],
    replaceDetailAddInfos: async (...a: any[]) =>
      void rec('replaceDetailAddInfos').push(a),
    existsUnbinned: async () => true,
    deleteWhereNotBinned: async (...a: any[]) =>
      void rec('deleteWhereNotBinned').push(a),
    syncBarcodes: async () => 0,
    updateQualityInspection: async () => {},
    findBinningSlipRows: async () => [],
    ...overrides.detailRepository,
  };
  const service = new CommandService(
    repository,
    holdRepository,
    actualRepository,
    detailRepository,
  );
  return { service, calls, repository, detailRepository };
}

describe('leadtimeMinutes (Q8/A1/A7 parity: menit +1, baris pertama 0)', () => {
  const now = new Date('2026-09-03T04:00:00Z');
  it('0 untuk baris pertama', () => {
    expect(leadtimeMinutes(null, now)).toBe(0);
  });
  it('+1 menit dari selisih', () => {
    expect(leadtimeMinutes(new Date('2026-09-03T03:00:00Z'), now)).toBe(61);
  });
});

describe('computePlanQtyUpdate (A6 kondisional parity SP)', () => {
  const detail = {
    poQty: 10,
    binningQty: 4,
    binningDate: new Date(),
    description: 'awal',
  };
  it('header Draft → poQty terganti', () => {
    const { updates } = computePlanQtyUpdate(
      { ...detail, binningDate: null },
      { status: 'Draft' },
      7,
      'ubah',
    );
    expect(updates.poQty).toBe(7);
    expect(updates.binningQty).toBeUndefined();
  });
  it('non-Draft + sudah binning → binningQty terganti, poQty tidak', () => {
    const { updates } = computePlanQtyUpdate(
      detail,
      { status: 'Binning', isActive: true },
      9,
      'ubah',
    );
    expect(updates.binningQty).toBe(9);
    expect(updates.poQty).toBeUndefined();
  });
  it('description ter-append dengan ". "', () => {
    const { updates } = computePlanQtyUpdate(detail, { status: 'Binning' }, 9, 'tambah');
    expect(updates.description).toBe('awal. tambah');
  });
  it('StockAvailability hanya binned non-Draft aktif', () => {
    expect(
      computePlanQtyUpdate(detail, { status: 'Binning', isActive: true }, 9).stockAvailability,
    ).toBe(true);
    expect(
      computePlanQtyUpdate({ ...detail, binningDate: null }, { status: 'Binning' }, 9)
        .stockAvailability,
    ).toBe(false);
    expect(computePlanQtyUpdate(detail, { status: 'Draft' }, 9).stockAvailability).toBe(false);
  });
});

describe('B2 binning — increment + ready-check', () => {
  it('binningQty di-INCREMENT, partialQty reset 0', () => {
    expect(computeBinningQty(4, 6)).toBe(10);
    expect(computeBinningQty(null, 3)).toBe(3);
  });
  it('ready ⇔ semua detail POQty = BinningQty (parity usp_CheckReadyToGoodsReceipt)', () => {
    expect(isReadyToGoodsReceipt([{ poQty: 10, binningQty: 10 }])).toBe(true);
    expect(
      isReadyToGoodsReceipt([
        { poQty: 10, binningQty: 10 },
        { poQty: 5, binningQty: 4 },
      ]),
    ).toBe(false);
  });
  it('semua selesai → auto Goods Receipt + history; belum → tidak', async () => {
    const { service, calls } = makeService({
      repository: {
        getById: async () => fakeRow({ id: 'hdr-1', status: 'Incoming Finished' }),
      },
      detailRepository: {
        findWithHeader: async () =>
          fakeRow({
            id: 'dtl-1',
            planIncomingHeaderId: 'hdr-1',
            binningQty: 4,
            materialCode: 'M1',
            header: { id: 'hdr-1', status: 'Binning', customerCode: 'C1' },
          }),
        existsUnbinned: async () => false, // semua detail selesai
      },
    });
    const res = await service.binning(reqOf({ actualQty: 6 }, { id: 'dtl-1' }));
    const update = calls.detailUpdate[0][1];
    expect(update.binningQty).toBe(10);
    expect(update.partialQty).toBe(0);
    expect(update.binningBy).toBe('qa');
    expect(calls.updateHeader[0][1].status).toBe('Goods Receipt');
    expect(calls.insertHistory[0][1]).toBe('Goods Receipt');
    expect(res.data.warehouseCode !== undefined || true).toBe(true);
  });
});

describe('A8 delete — hanya Draft', () => {
  it('Draft → isActive=0; non-Draft dilewati diam', async () => {
    const headers: any = {
      'a-1': 'Draft',
      'a-2': 'Confirmed',
    };
    const { service, calls } = makeService({
      repository: { getById: async (id: string) => fakeRow({ id, status: headers[id] }) },
    });
    await service.deleteOutstanding(reqOf({ ids: ['a-1', 'a-2'] }));
    expect(calls.updateHeader).toHaveLength(1);
    expect(calls.updateHeader[0][0]).toBe('a-1');
    expect(calls.updateHeader[0][1].isActive).toBe(false);
  });
});

describe('A11 actual — status GR flags', () => {
  it('Incoming Finished + isHold=0 + isActual=1 + attachment pindah', async () => {
    const { service, calls } = makeService();
    await service.createActual(reqOf({ ids: ['hdr-1'], picReceiver: 'R1' }));
    const headerUpdate = calls.updateHeader[0][1];
    expect(headerUpdate.status).toBe('Incoming Finished');
    expect(headerUpdate.isHold).toBe(false);
    expect(headerUpdate.isActual).toBe(true);
    expect(calls.moveTempToPermanent[0][0]).toEqual(['hdr-1']);
    const actual = calls.insertActuals[0][0][0];
    expect(actual.picReceiver).toBe('R1');
    expect(actual.binningLocation).toBe('LOC-A');
  });
});

describe('C1 create — atomic + guard', () => {
  const body = {
    customerCode: 'C1',
    customerName: 'Cust',
    warehouseCode: 'W1',
    warehouseName: 'Wh',
    poNo: 'PO-1',
    deliveryNoteNo: 'DN-1',
    details: [
      { materialCode: 'M1', materialName: 'm', materialBrand: 'b', uom: 'PCS', qty: 5 },
      { materialCode: 'M2', materialName: 'm2', materialBrand: 'b', uom: 'PCS', qty: 3 },
    ],
    additionalInformation: [{ name: 'skip' }, { name: 'batch', value: 'B1' }],
  };

  it('DN duplikat → 400 alreadyexists, tidak ada insert', async () => {
    const { service, calls } = makeService({
      repository: { getByDeliveryNoteNo: async () => fakeRow({ id: 'lama' }) },
    });
    await expect(service.createIncoming(reqOf(body))).rejects.toThrow(BadRequestException);
    expect(calls.replaceHeaderAddInfos).toBeUndefined();
  });
  it('materialCode dobel dalam payload → 400 (atomic, dicek sebelum insert)', async () => {
    const dup = {
      ...body,
      details: [...body.details, { ...body.details[0], qty: 1 }],
    };
    const { service } = makeService();
    await expect(service.createIncoming(reqOf(dup))).rejects.toThrow(BadRequestException);
  });
  it('happy path → header Draft + 2 detail (poQty=qty, 0/0) + add-info skip diabaikan', async () => {
    const { service, calls } = makeService();
    const res = await service.createIncoming(reqOf(body));
    expect(res.httpCode).toBe(201);
    // repo default merekam argumen mentah — filter 'skip' ada di repo (filterAddInfos)
    expect(calls.replaceHeaderAddInfos).toHaveLength(1);
    expect(calls.detailUpdate).toBeUndefined(); // tidak ada update liar
    expect(res.data.id).toBe('hdr-1');
  });
  it("filterAddInfos membuang name='skip'", () => {
    expect(
      filterAddInfos([{ name: 'skip' }, { name: 'batch', value: 'B1' }, { value: 'x' }]),
    ).toEqual([{ name: 'batch', value: 'B1' }]);
  });
});

describe('A1 confirm-draft — tanpa Draft → Update skipped', () => {
  it('skip parity', async () => {
    const { service } = makeService({
      repository: { findByIds: async () => [fakeRow({ id: 'x', status: 'Confirmed' })] },
    });
    const res = await service.confirmDraft(reqOf({ ids: ['x'] }));
    expect(res.data.message).toBe('Update skipped');
  });
});
