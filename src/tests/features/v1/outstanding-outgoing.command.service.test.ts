import { Transaction } from 'sequelize';

jest.mock('@/utils', () => ({
  sequelize: {
    transaction: jest.fn(async (cb: (t: Transaction) => Promise<void>) =>
      cb({} as Transaction),
    ),
  },
  nowWib: () => new Date('2026-09-08T04:00:00Z'),
}));

jest.mock('@/integrations/thrid-party/aws-sqs.third', () => ({
  awsSqsThird: {
    publishToInventory: jest.fn(async () => undefined),
  },
}));

import { CommandService } from '@/features/v1/outstanding-outgoing/command.service';
import { leadtimeMinutes } from '@/features/v1/outstanding-outgoing/constants';
import { BadRequestException } from '@/shared-libs/exceptions';
import { awsSqsThird } from '@/integrations/thrid-party/aws-sqs.third';

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
    getById: async (id: string) =>
      service.headers[id] ? fakeRow(service.headers[id]) : null,
    findByIds: async (ids: string[]) =>
      ids.map((id) => fakeRow(service.headers[id] ?? { id })),
    updateHeader: async (...a: any[]) => void rec('updateHeader').push(a),
    setStatusForIds: async (...a: any[]) => void rec('setStatusForIds').push(a),
    insertHistory: async (...a: any[]) => void rec('insertHistory').push(a),
    ...overrides.repository,
  };
  const detailRepository: any = {
    getById: async (id: string) =>
      service.details[id] ? fakeRow(service.details[id]) : null,
    findByIds: async (ids: string[]) =>
      ids.map((id) => fakeRow(service.details[id] ?? { id })),
    findByHeader: async (hid: string) =>
      Object.values(service.details)
        .filter((d: any) => d.planOutgoingHeaderId === hid)
        .map((d: any) => fakeRow(d)),
    findByHeaders: async (hids: string[]) =>
      Object.values(service.details)
        .filter((d: any) => hids.includes(d.planOutgoingHeaderId))
        .map((d: any) => fakeRow(d)),
    findByPackagingNo: async (no: string) =>
      Object.values(service.details)
        .filter((d: any) => d.packagingNo === no)
        .map((d: any) => fakeRow(d)),
    findByPackagingNos: async (nos: string[]) =>
      Object.values(service.details)
        .filter((d: any) => nos.includes(d.packagingNo))
        .map((d: any) => fakeRow(d)),
    update: async (...a: any[]) => void rec('detailUpdate').push(a),
    ...overrides.detailRepository,
  };
  const packagingRepository: any = {
    createMany: async (...a: any[]) => void rec('packagingCreate').push(a),
    setDetailPackagingNo: async (...a: any[]) =>
      void rec('setDetailPackagingNo').push(a),
    setShipmentNos: async (nos: string[], shipmentNo: string) => {
      rec('setShipmentNos').push([nos, shipmentNo]);
      for (const pk of Object.values(service.packagings) as any[]) {
        if (nos.includes(pk.packagingNo)) pk.shipmentNo = shipmentNo;
      }
    },
    findByPackagingNos: async (nos: string[]) =>
      Object.values(service.packagings)
        .filter((p: any) => nos.includes(p.packagingNo))
        .map((p: any) => fakeRow(p)),
    findExistingPackagingNos: async () => [],
    ...overrides.packagingRepository,
  };
  const service: any = {
    headers: overrides.headers ?? {},
    details: overrides.details ?? {},
    packagings: overrides.packagings ?? {},
  };
  const sut = new CommandService(repository, detailRepository, packagingRepository);
  return { sut, calls, service };
}

const publishMock = awsSqsThird.publishToInventory as jest.Mock;

describe('nomor PKG/SHP — prefix+8char (parity LOGIS)', () => {
  it('charset 32 (tanpa I/O/0), tepat 8 char', () => {
    expect('A3K9M2P7').toMatch(/^[A-HJ-NP-Z1-9]{8}$/);
  });
});

describe('leadtimeMinutes (parity outstanding-incoming: menit +1, baris pertama 0)', () => {
  const now = new Date('2026-09-03T04:00:00Z');
  it('0 untuk baris pertama', () => {
    expect(leadtimeMinutes(null, now)).toBe(0);
  });
  it('+1 menit dari selisih (wall-clock, bebas skew TZ)', () => {
    expect(leadtimeMinutes(new Date('2026-09-03T03:00:00Z'), now)).toBe(61);
  });
});

describe('A1 confirmDraft', () => {
  it('hanya Draft di-update + history; tanpa Draft → updateSkipped', async () => {
    const { sut, calls } = makeService({
      headers: {
        a: { id: 'a', status: 'Draft' },
        b: { id: 'b', status: 'Confirmed' },
      },
    });
    const ok = await sut.confirmDraft(reqOf({ ids: ['a', 'b'] }));
    expect(ok.data.message).toBe('Success');
    expect(calls.updateHeader).toHaveLength(1); // hanya header Draft
    expect(calls.insertHistory).toHaveLength(1);

    const none = await sut.confirmDraft(reqOf({ ids: ['b'] }));
    expect(none.data.message).toBe('Update skipped');
  });
});

describe('A3 deleteOutstanding', () => {
  it('soft delete Draft saja; non-Draft skip diam', async () => {
    const { sut, calls } = makeService({
      headers: {
        a: { id: 'a', status: 'Draft' },
        b: { id: 'b', status: 'Picking' },
      },
    });
    await sut.deleteOutstanding(reqOf({ ids: ['a', 'b'] }));
    expect(calls.updateHeader).toHaveLength(1);
    expect((calls.updateHeader[0] as any[])[1].isActive).toBe(false);
  });
});

describe('A4 updateStatus', () => {
  it('guard Cancelled / Ready To Ship → updateSkipped', async () => {
    const { sut } = makeService({
      headers: {
        a: { id: 'a', status: 'Cancelled' },
        b: { id: 'b', status: 'Ready To Ship' },
      },
    });
    const r1 = await sut.updateStatus('a', { status: 'Picking' } as any, reqOf({}));
    expect(r1.data.message).toBe('Update skipped');
    const r2 = await sut.updateStatus('b', { status: 'Picking' } as any, reqOf({}));
    expect(r2.data.message).toBe('Update skipped');
  });

  it('Transit tanpa POType MUTATION → 400', async () => {
    const { sut } = makeService({
      headers: { a: { id: 'a', status: 'Confirmed', poType: 'Regular' } },
    });
    await expect(
      sut.updateStatus('a', { status: 'Transit In' } as any, reqOf({})),
    ).rejects.toThrow(BadRequestException);
  });

  it('valid → update + history', async () => {
    const { sut, calls } = makeService({
      headers: { a: { id: 'a', status: 'Confirmed', poType: 'Regular' } },
    });
    const r = await sut.updateStatus('a', { status: 'Picking' } as any, reqOf({}));
    expect(r.data.message).toBe('Success');
    expect(calls.updateHeader).toHaveLength(1);
    expect(calls.insertHistory).toHaveLength(1);
  });
});

describe('A6 updatePlanQty', () => {
  it('Draft → set POQty + append description; picked+Draft → SQS WHSREVOUT', async () => {
    const { sut, calls } = makeService({
      headers: { h: { id: 'h', status: 'Draft', customerCode: 'C1' } },
      details: { d: { id: 'd', planOutgoingHeaderId: 'h', poQty: 10, pickingQty: 6, pickingDate: new Date(), description: 'awal' } },
    });
    await sut.updatePlanQty('d', { planQty: 12, description: 'koreksi' } as any, reqOf({}));
    const patch = (calls.detailUpdate[0] as any[])[1];
    expect(patch.poQty).toBe(12);
    expect(patch.description).toBe('awal. koreksi');
    expect(publishMock).toHaveBeenCalledWith(
      expect.objectContaining({ QtySOH: 12 - 6, QtyPlanOutgoing: 12 }),
      expect.any(String),
      'WHSREVOUT',
    );
    publishMock.mockClear();
  });

  it('non-Draft + picked → set PickingQty, tanpa SQS', async () => {
    const { sut, calls } = makeService({
      headers: { h: { id: 'h', status: 'Picking', customerCode: 'C1' } },
      details: { d: { id: 'd', planOutgoingHeaderId: 'h', poQty: 10, pickingQty: 6, pickingDate: new Date() } },
    });
    await sut.updatePlanQty('d', { planQty: 9, description: 'x' } as any, reqOf({}));
    const patch = (calls.detailUpdate[0] as any[])[1];
    expect(patch.pickingQty).toBe(9);
    expect(patch.poQty).toBeUndefined();
    expect(publishMock).not.toHaveBeenCalled();
  });
});

describe('A7 submitPicking', () => {
  it('SET pickingQty=actualQty + SQS WHSOUT; 0/null → POQty', async () => {
    const { sut, calls } = makeService({
      headers: { h: { id: 'h', status: 'Picking', customerCode: 'C1' } },
      details: { d: { id: 'd', planOutgoingHeaderId: 'h', poQty: 10, pickingQty: 0, materialBarcode: 'BC-1' } },
    });
    await sut.submitPicking('d', { detailId: 'd', actualQty: 0, materialBarcode: 'BC-1' } as any, reqOf({}));
    const patch = (calls.detailUpdate[0] as any[])[1];
    expect(patch.pickingQty).toBe(10); // 0 → default POQty (parity SP)
    expect(publishMock).toHaveBeenCalledWith(
      expect.objectContaining({ QtySOH: 10 }),
      expect.any(String),
      'WHSOUT',
    );
    publishMock.mockClear();
  });

  it('"0" = bypass — TIDAK kena mismatch (parity FE)', async () => {
    const { sut } = makeService({
      headers: { h: { id: 'h', status: 'Picking' } },
      details: {
        d: {
          id: 'd',
          planOutgoingHeaderId: 'h',
          poQty: 5,
          pickingQty: 0,
          materialBarcode: 'BC-1',
          materialLocationBarcode: 'LOC-1',
        },
      },
    });
    const r = await sut.submitPicking(
      'd',
      { detailId: 'd', actualQty: 5, materialBarcode: '0', locationBarcode: '0' } as any,
      reqOf({}),
    );
    expect(r.data.qtySoh).toBe(5);
  });

  it('Draft → 400; barcode mismatch → 400', async () => {
    const { sut } = makeService({
      headers: { h: { id: 'h', status: 'Draft' } },
      details: { d: { id: 'd', planOutgoingHeaderId: 'h', poQty: 5 } },
    });
    await expect(
      sut.submitPicking('d', { detailId: 'd' } as any, reqOf({})),
    ).rejects.toThrow(BadRequestException);

    const { sut: s2 } = makeService({
      headers: { h: { id: 'h', status: 'Picking' } },
      details: { d: { id: 'd', planOutgoingHeaderId: 'h', poQty: 5, materialBarcode: 'BC-1' } },
    });
    await expect(
      s2.submitPicking('d', { detailId: 'd', materialBarcode: 'SALAH' } as any, reqOf({})),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('A8 createPackagings', () => {
  const body = {
    detailIds: ['d1', 'd2'],
    packagings: [{ materialCode: 'M1', qty: 7 }],
  };

  it('guard alreadyPackaged & materialMismatch', async () => {
    const packaged = makeService({
      headers: { h: { id: 'h', customerDestination: 'X' } },
      details: {
        d1: { id: 'd1', planOutgoingHeaderId: 'h', packagingNo: 'PKG-1', materialCode: 'M1' },
        d2: { id: 'd2', planOutgoingHeaderId: 'h', materialCode: 'M1' },
      },
    });
    await expect(
      packaged.sut.createPackagings(reqOf(body)),
    ).rejects.toThrow('alreadyPackaged');

    // detail tanpa grup material di body → materialMismatch
    // (destination beda BOLEH — tiap grup bawa destination sendiri)
    const mismatch = makeService({
      headers: { h: { id: 'h', customerDestination: 'X' } },
      details: {
        d1: { id: 'd1', planOutgoingHeaderId: 'h', materialCode: 'OTHER' },
        d2: { id: 'd2', planOutgoingHeaderId: 'h', materialCode: 'M1' },
      },
    });
    await expect(mismatch.sut.createPackagings(reqOf(body))).rejects.toThrow(
      'materialMismatch',
    );
  });

  it('valid → insert + set detail.packagingNo + headers → Packaging (tanpa history)', async () => {
    const { sut, calls } = makeService({
      headers: { h: { id: 'h', customerDestination: 'X', customerCode: 'CN', warehouseCode: 'WH' } },
      details: {
        d1: { id: 'd1', planOutgoingHeaderId: 'h', materialCode: 'M1' },
        d2: { id: 'd2', planOutgoingHeaderId: 'h', materialCode: 'M1' },
      },
    });
    const r = await sut.createPackagings(reqOf(body));
    expect(r.data.packagingNos[0]).toMatch(/^PKG[A-HJ-NP-Z1-9]{8}$/);
    expect(calls.packagingCreate).toHaveLength(1);
    expect(calls.setDetailPackagingNo).toHaveLength(1);
    expect(calls.setStatusForIds[0][1]).toBe('Packaging');
    expect(calls.insertHistory).toBeUndefined(); // parity SP: tanpa history
  });
});

describe('A9 readyToShip', () => {
  const pkgBody = { packagingNos: ['PKG-A'] };

  it('guard destinationMismatch', async () => {
    const { sut } = makeService({
      packagings: {
        p1: { packagingNo: 'PKG-A', customerDestination: 'X' },
        p2: { packagingNo: 'PKG-B', customerDestination: 'Y' },
      },
    });
    await expect(
      sut.readyToShip(reqOf({ packagingNos: ['PKG-A', 'PKG-B'] })),
    ).rejects.toThrow('destinationMismatch');
  });

  it('header → Ready To Ship hanya bila SEMUA detail ter-shipment (+history)', async () => {
    // h1: semua detail packaging PKG-A (valid); h2: ada detail tanpa packaging (invalid)
    const { sut, calls } = makeService({
      headers: {
        h1: { id: 'h1', status: 'Packaging', customerCode: 'CN', warehouseCode: 'WH' },
        h2: { id: 'h2', status: 'Packaging', customerCode: 'CN', warehouseCode: 'WH' },
      },
      details: {
        d1: { id: 'd1', planOutgoingHeaderId: 'h1', packagingNo: 'PKG-A' },
        d3: { id: 'd3', planOutgoingHeaderId: 'h2', packagingNo: 'PKG-A' },
        d4: { id: 'd4', planOutgoingHeaderId: 'h2', packagingNo: null },
      },
      packagings: { p1: { packagingNo: 'PKG-A', customerDestination: 'X' } },
    });
    const r = await sut.readyToShip(reqOf(pkgBody));
    expect(r.data.shipmentNo).toMatch(/^SHP[A-HJ-NP-Z1-9]{8}$/);
    expect(calls.setShipmentNos).toHaveLength(1);
    expect(calls.setStatusForIds[0][0]).toEqual(['h1']); // h2 tidak ikut
    expect(calls.insertHistory).toHaveLength(1);
  });
});

describe('A5 bulkUpdateStatus (sequential)', () => {
  it('valid = QC + fully picked; sisanya skip dengan DN', async () => {
    const { sut } = makeService({
      headers: {
        ok: { id: 'ok', status: 'Quality Control', deliveryNoteNo: 'DN-OK' },
        partial: { id: 'partial', status: 'Quality Control', deliveryNoteNo: 'DN-PART' },
        wrong: { id: 'wrong', status: 'Picking', deliveryNoteNo: 'DN-WRONG' },
      },
      details: {
        d1: { id: 'd1', planOutgoingHeaderId: 'ok', poQty: 5, pickingQty: 5 },
        d2: { id: 'd2', planOutgoingHeaderId: 'partial', poQty: 5, pickingQty: 3 },
        d3: { id: 'd3', planOutgoingHeaderId: 'wrong', poQty: 5, pickingQty: 5 },
      },
    });
    const r = await sut.bulkUpdateStatus(
      reqOf({ ids: ['ok', 'partial', 'wrong'], status: 'Ready To Ship' }),
    );
    expect(r.data.updated).toBe(1);
    expect(r.data.skipped).toEqual(['DN-PART', 'DN-WRONG']);
  });
});
