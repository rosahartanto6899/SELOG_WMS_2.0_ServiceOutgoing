import { inject, injectable } from 'inversify';
import { Transaction } from 'sequelize';
import { HTTP_STATUS } from '@/shared-libs/constants/http-status.constant';
import {
  BadRequestException,
  NotFoundException,
} from '@/shared-libs/exceptions';
import { IDataUser } from '@/shared-libs/interfaces/user-data.interface';
import { sequelize, nowWib } from '@/utils';
import { UniqueIdGenerator } from '@/shared-libs/utils/unique-id-generator.util';
import { awsSqsThird } from '@/integrations/thrid-party/aws-sqs.third';
import {
  OutstandingOutgoingRepository,
  PlanOutgoingDetailRepository,
} from './repositories';
import { PlanOutgoingPackagingRepository } from './repositories/plan-outgoing-packaging.repository';
import { ByIdTransform } from './transforms';
import {
  OUTGOING_STATUS,
  outstandingOutgoingConstant as cst,
} from './constants';
import {
  AddDetailDto,
  CreateOutgoingDto,
  DetailRowDto,
  UpdateOutgoingDetailDto,
  UpdateOutgoingHeaderDto,
  IdsActionDto,
  UpdateStatusDto,
  PlanQtyDto,
  PickingDto,
  CreatePackagingDto,
  ReadyToShipDto,
  BulkStatusDto,
} from './dtos';

const userOf = (req: any): string => {
  const userData = req.user as unknown as IDataUser;
  return userData?.tokenName ?? userData?.tokenUserId ?? 'system';
};

const toDate = (v?: string): Date | null => (v ? new Date(v) : null);

// ================= Input manual (C) — parity ServiceIncoming C1–C4/C6 =================

@injectable()
export class CommandService {
  constructor(
    @inject(OutstandingOutgoingRepository)
    private readonly repository: OutstandingOutgoingRepository,
    @inject(PlanOutgoingDetailRepository)
    private readonly detailRepository: PlanOutgoingDetailRepository,
    @inject(PlanOutgoingPackagingRepository)
    private readonly packagingRepository: PlanOutgoingPackagingRepository,
  ) {}

  /** C1 POST / — satu submit atomic (header + semua detail + add-info) */
  async createOutgoing(req: any) {
    const body = req.body as CreateOutgoingDto;
    const userBy = userOf(req);
    const now = nowWib();

    // guard duplikat materialCode dalam payload (atomic — dicek sebelum insert)
    const codes = body.details.map((d) => d.materialCode);
    if (new Set(codes).size !== codes.length) {
      throw new BadRequestException(
        'duplicate materialCode in payload',
        codes
          .filter((c, i) => codes.indexOf(c) !== i)
          .map((c) => ({ field: 'details', message: [`${c} duplicated`] })),
      );
    }

    let headerId = '';
    await sequelize.transaction(async (t: Transaction) => {
      // guard DN unik (parity SP: EXISTS semua header, termasuk soft-deleted)
      const existing = await this.repository.getByDeliveryNoteNo(
        body.deliveryNoteNo,
        t,
        true,
      );
      if (existing) {
        throw new BadRequestException(cst.messages.alreadyExists);
      }

      const header = await this.repository.createHeader(
        {
          customerCode: body.customerCode,
          customerName: body.customerName,
          warehouseCode: body.warehouseCode,
          warehouseName: body.warehouseName,
          deliveryNoteNo: body.deliveryNoteNo,
          outgoingDate: toDate(body.outgoingDate),
          poNo: body.poNo,
          poType: body.poType,
          poDate: toDate(body.poDate),
          customerDestination: body.customerDestination,
          referenceNo: body.referenceNo,
          materialCategory: body.materialCategory ?? 'Part',
          description: body.description,
          status: OUTGOING_STATUS.DRAFT,
          isHold: false,
          isActive: true,
          createdBy: userBy,
          createdDate: now,
        },
        t,
      );
      headerId = header.get('id') as string;

      for (const d of body.details) {
        const detail = await this.detailRepository.create(
          {
            planOutgoingHeaderId: headerId,
            materialCode: d.materialCode,
            materialName: d.materialName,
            materialBrand: d.materialBrand,
            materialBarcode: d.barcode ?? null,
            materialLocationBarcode: d.locationBarcode ?? null,
            uom: d.uom,
            poQty: d.qty,
            pickingQty: 0,
            createdBy: userBy,
            createdDate: now,
          },
          t,
        );
        await this.detailRepository.replaceDetailAddInfos(
          detail.get('id') as string,
          d.additionalInformation ?? [],
          userBy,
          t,
        );
      }

      await this.repository.replaceHeaderAddInfos(
        headerId,
        body.additionalInformation ?? [],
        userBy,
        t,
      );
    });

    return { data: { id: headerId }, httpCode: HTTP_STATUS.CREATED };
  }

  /** C2 POST /:id/details — tambah material ke DN existing */
  async addDetails(req: any) {
    const { id } = req.params;
    const { details } = req.body as AddDetailDto;
    const userBy = userOf(req);
    const now = nowWib();

    const header = await this.repository.getById(id);
    if (!header) {
      throw new NotFoundException(cst.messages.notFound);
    }

    await sequelize.transaction(async (t: Transaction) => {
      for (const d of details as DetailRowDto[]) {
        const existing = await this.detailRepository.getByHeaderAndMaterial(
          id,
          d.materialCode,
          t,
        );
        if (existing) {
          throw new BadRequestException(cst.messages.alreadyExists);
        }
        const detail = await this.detailRepository.create(
          {
            planOutgoingHeaderId: id,
            materialCode: d.materialCode,
            materialName: d.materialName,
            materialBrand: d.materialBrand,
            materialBarcode: d.barcode ?? null,
            materialLocationBarcode: d.locationBarcode ?? null,
            uom: d.uom,
            poQty: d.qty,
            pickingQty: 0,
            createdBy: userBy,
            createdDate: now,
          },
          t,
        );
        await this.detailRepository.replaceDetailAddInfos(
          detail.get('id') as string,
          d.additionalInformation ?? [],
          userBy,
          t,
        );
      }
    });

    return {
      data: { message: cst.messages.success },
      httpCode: HTTP_STATUS.CREATED,
    };
  }

  /** C3 PUT /:id — edit header + add-info replace */
  async updateOutgoingHeader(req: any) {
    const { id } = req.params;
    const body = req.body as UpdateOutgoingHeaderDto;
    const userBy = userOf(req);

    const header = await this.repository.getById(id);
    if (!header) {
      throw new NotFoundException(cst.messages.notFound);
    }

    await sequelize.transaction(async (t: Transaction) => {
      // guard DN dipakai header lain (parity: DeliveryNoteNo=@x AND Id<>@ID)
      if (body.deliveryNoteNo) {
        const clash = await this.repository.getByDeliveryNoteNo(
          body.deliveryNoteNo,
          t,
          true,
        );
        if (clash && clash.get('id') !== id) {
          throw new BadRequestException(cst.messages.alreadyExists);
        }
      }

      const updates: any = { modifiedBy: userBy, modifiedDate: nowWib() };
      if (body.customerCode != null) updates.customerCode = body.customerCode;
      if (body.customerName != null) updates.customerName = body.customerName;
      if (body.warehouseCode != null) updates.warehouseCode = body.warehouseCode;
      if (body.warehouseName != null) updates.warehouseName = body.warehouseName;
      if (body.poNo != null) updates.poNo = body.poNo;
      if (body.poType != null) updates.poType = body.poType;
      if (body.poDate != null) updates.poDate = toDate(body.poDate);
      if (body.deliveryNoteNo != null) updates.deliveryNoteNo = body.deliveryNoteNo;
      if (body.outgoingDate != null) updates.outgoingDate = toDate(body.outgoingDate);
      if (body.customerDestination != null) updates.customerDestination = body.customerDestination;
      if (body.referenceNo != null) updates.referenceNo = body.referenceNo;
      if (body.materialCategory != null) updates.materialCategory = body.materialCategory;
      if (body.description != null) updates.description = body.description;

      await this.repository.updateHeader(id, updates, t);
      await this.repository.replaceHeaderAddInfos(
        id,
        body.additionalInformation ?? [],
        userBy,
        t,
      );
    });

    return { data: { message: cst.messages.success }, httpCode: HTTP_STATUS.OK };
  }

  /** C4 PUT /details/:id — hanya poQty + add-info replace */
  async updateOutgoingDetail(req: any) {
    const { id } = req.params;
    const { qty, additionalInformation } = req.body as UpdateOutgoingDetailDto;
    const userBy = userOf(req);

    const detail = await this.detailRepository.getById(id);
    if (!detail) {
      throw new NotFoundException('Detail not found');
    }

    await sequelize.transaction(async (t: Transaction) => {
      await this.detailRepository.update(
        id,
        { poQty: qty, modifiedBy: userBy, modifiedDate: nowWib() },
        t,
      );
      await this.detailRepository.replaceDetailAddInfos(
        id,
        additionalInformation ?? [],
        userBy,
        t,
      );
    });

    return { data: { message: cst.messages.success }, httpCode: HTTP_STATUS.OK };
  }

  /** C6 GET /:id/edit — data form edit + flag bisa-edit per detail */
  async getEdit(req: any) {
    const { id } = req.params;
    const header = await this.repository.findDetailById(id);
    if (!header) {
      throw new NotFoundException(cst.messages.notFound);
    }
    const plain = header.get({ plain: true }) as any;
    return {
      data: {
        ...new ByIdTransform().transform(plain),
        details: (plain.details ?? []).map((d: any) => ({
          ...new ByIdTransform().transformDetail(d),
          canEdit: d.pickingDate == null, // flag bisa-edit per detail
        })),
      },
      httpCode: HTTP_STATUS.OK,
    };
  }

// ================= Aksi massal (spec 004) — parity SP, tanpa SP =================

/** A1 POST /confirm-draft (usp_ConfirmDraftData): hanya Draft di-update
 *  (+history); tanpa Draft → 'Update skipped'. */
async confirmDraft(req: any) {
  const { ids } = req.body as IdsActionDto;
  const userBy = (req.body as any).userLogin ?? userOf(req);
  const headers = await this.repository.findByIds(ids);
  const drafts = headers.filter(
    (h) => h.get('status') === OUTGOING_STATUS.DRAFT,
  );

  if (!drafts.length) {
    return {
      data: { message: cst.messages.updateSkipped },
      httpCode: HTTP_STATUS.OK,
    };
  }

  await sequelize.transaction(async (t) => {
    for (const header of drafts) {
      const id = header.get('id') as string;
      await this.repository.updateHeader(
        id,
        {
          status: OUTGOING_STATUS.CONFIRMED,
          isActive: true,
          modifiedBy: userBy,
          modifiedDate: nowWib(),
        },
        t,
      );
      await this.repository.insertHistory(
        id,
        OUTGOING_STATUS.CONFIRMED,
        userBy,
        t,
      );
    }
  });

  return { data: { message: cst.messages.success }, httpCode: HTTP_STATUS.OK };
}

/** A2 POST /confirm-cancellation (usp_ConfirmDataCancellation): SEMUA id →
 *  Cancelled + isActive=0 + history (tanpa skip); SQS WHSCLIN kembalikan
 *  SOH per material yang sudah dipicking (SUM PickingQty). */
async confirmCancellation(req: any) {
  const { ids } = req.body as IdsActionDto;
  const userBy = (req.body as any).userLogin ?? userOf(req);
  const headers = await this.repository.findByIds(ids);
  const active = headers.filter((h) => h.get('isActive'));

  if (!active.length) {
    return {
      data: { message: cst.messages.updateSkipped },
      httpCode: HTTP_STATUS.OK,
    };
  }

  await sequelize.transaction(async (t) => {
    for (const header of active) {
      const id = header.get('id') as string;
      const now = nowWib();

      await this.repository.updateHeader(
        id,
        {
          status: OUTGOING_STATUS.CANCELLED,
          isActive: false,
          modifiedBy: userBy,
          modifiedDate: now,
        },
        t,
      );
      await this.repository.insertHistory(
        id,
        OUTGOING_STATUS.CANCELLED,
        userBy,
        t,
      );

      // SQS WHSCLIN — kembalikan SOH per material yang sudah dipicking
      // (parity SP: hanya PickingDate <> '', SUM(PickingQty))
      const details = await this.detailRepository.findByHeader(id, t);
      const qtyByMaterial = new Map<string, number>();
      for (const d of details) {
        if (!d.get('pickingDate')) continue;
        const code = d.get('materialCode') as string;
        qtyByMaterial.set(
          code,
          (qtyByMaterial.get(code) ?? 0) +
            ((d.get('pickingQty') as number) ?? 0),
        );
      }
      for (const [code, qty] of qtyByMaterial) {
        if (!qty) continue;
        const d = details.find((x) => x.get('materialCode') === code)!;
        await awsSqsThird.publishToInventory(
          {
            CustomerCode: (header.get('customerCode') as string) ?? null,
            CustomerName: (header.get('customerName') as string) ?? null,
            DeliveryNoteNo: (header.get('deliveryNoteNo') as string) ?? null,
            POType: (header.get('poType') as string) ?? null,
            PODate: header.get('poDate')
              ? new Date(header.get('poDate') as Date).toISOString()
              : null,
            WarehouseCode: (header.get('warehouseCode') as string) ?? null,
            WarehouseName: (header.get('warehouseName') as string) ?? null,
            MaterialCode: code,
            MaterialName: (d.get('materialName') as string) ?? null,
            MaterialBrand: (d.get('materialBrand') as string) ?? null,
            UoM: (d.get('uom') as string) ?? null,
            QtyPlanIncoming: 0,
            QtyPlanOutgoing: 0,
            QtySOH: qty,
            QtyAvailable: 0,
          },
          userBy,
          'WHSCLIN',
        );
      }
    }
  });

  return { data: { message: cst.messages.success }, httpCode: HTTP_STATUS.OK };
}

/** A3 POST /delete (usp_DeleteOutstandingOutgoing): soft delete Draft saja,
 *  non-Draft di-skip diam (tanpa history — parity SP). */
async deleteOutstanding(req: any) {
  const { ids } = req.body as IdsActionDto;
  const userBy = (req.body as any).userLogin ?? userOf(req);
  const now = nowWib();
  await sequelize.transaction(async (t) => {
    for (const id of ids) {
      const header = await this.repository.getById(id, t);
      if (header?.get('status') === OUTGOING_STATUS.DRAFT) {
        await this.repository.updateHeader(
          id,
          {
            isActive: false,
            deletedDate: now,
            deletedBy: userBy,
            modifiedDate: now,
            modifiedBy: userBy,
          },
          t,
        );
      }
    }
  });
  return { data: null, httpCode: HTTP_STATUS.OK };
}

/** A4 PUT /:id/status (usp_UpdateStatusOutgoing): guard status header ∈
 *  ('Cancelled','Ready To Ship') → 'Update skipped'; Transit hanya utk
 *  MUTATION + warehouse TRANS (guard UI legacy); +history leadtime. */
async updateStatus(id: string, body: UpdateStatusDto, req: any) {
  const userBy = userOf(req);
  const header = await this.repository.getById(id);
  if (!header) {
    throw new NotFoundException(cst.messages.notFound);
  }
  const status = header.get('status') as string | null;

  if (
    status === OUTGOING_STATUS.CANCELLED ||
    status === OUTGOING_STATUS.READY_TO_SHIP
  ) {
    return {
      data: { message: cst.messages.updateSkipped },
      httpCode: HTTP_STATUS.OK,
    };
  }

  // Transit guard: MUTATION + warehouse mengandung TRANS (parity JS legacy btnTransit*)
  if (
    (body.status === OUTGOING_STATUS.TRANSIT_IN ||
      body.status === OUTGOING_STATUS.TRANSIT_OUT) &&
    ((header.get('poType') as string | null) ?? '').toUpperCase() !== 'MUTATION'
  ) {
    throw new BadRequestException('transit requires POType MUTATION');
  }

  const now = nowWib();
  await sequelize.transaction(async (t) => {
    await this.repository.updateHeader(
      id,
      { status: body.status, modifiedBy: userBy, modifiedDate: now },
      t,
    );
    await this.repository.insertHistory(id, body.status, userBy, t);
  });

  return { data: { message: cst.messages.success }, httpCode: HTTP_STATUS.OK };
}

/** A6 PUT /details/:id/plan-qty (usp_UpdatePlanQtyOutstandingOutgoing):
 *  Draft → set POQty; non-Draft + picked → set PickingQty; description
 *  di-append '. baru'; SQS WHSREVOUT (QtySOH = planQty − pickingQty lama)
 *  hanya bila detail picked & status Draft. Tanpa history (parity SP). */
async updatePlanQty(detailId: string, body: PlanQtyDto, req: any) {
  const userBy = userOf(req);
  const detail = await this.detailRepository.getById(detailId);
  if (!detail) {
    throw new NotFoundException('Plan outgoing detail not found');
  }
  const headerId = detail.get('planOutgoingHeaderId') as string;
  const header = await this.repository.getById(headerId);
  if (!header) {
    throw new NotFoundException(cst.messages.notFound);
  }
  const isDraft = header.get('status') === OUTGOING_STATUS.DRAFT;
  const isPicked = !!detail.get('pickingDate');
  const oldPickingQty = (detail.get('pickingQty') as number) ?? 0;

  const patch: Record<string, unknown> = { modifiedDate: nowWib() };
  if (isDraft) {
    patch.poQty = body.planQty;
  }
  if (isPicked && !isDraft) {
    patch.pickingQty = body.planQty;
  }
  const oldDesc = (detail.get('description') as string | null) ?? '';
  patch.description = oldDesc
    ? `${oldDesc}. ${body.description}`
    : body.description;

  // SQS WHSREVOUT — snapshot stok parity SP (hanya picked & Draft)
  const needsSqs = isPicked && isDraft;
  const qtySoh = body.planQty - oldPickingQty;

  await sequelize.transaction(async (t) => {
    await this.detailRepository.update(detailId, patch as any, t);

    if (needsSqs && qtySoh !== 0) {
      await awsSqsThird.publishToInventory(
        {
          CustomerCode: (header.get('customerCode') as string) ?? null,
          CustomerName: (header.get('customerName') as string) ?? null,
          DeliveryNoteNo: (header.get('deliveryNoteNo') as string) ?? null,
          POType: (header.get('poType') as string) ?? null,
          PODate: header.get('poDate')
            ? new Date(header.get('poDate') as Date).toISOString()
            : null,
          WarehouseCode: (header.get('warehouseCode') as string) ?? null,
          WarehouseName: (header.get('warehouseName') as string) ?? null,
          MaterialCode: (detail.get('materialCode') as string) ?? null,
          MaterialName: (detail.get('materialName') as string) ?? null,
          MaterialBrand: (detail.get('materialBrand') as string) ?? null,
          UoM: (detail.get('uom') as string) ?? null,
          QtyPlanIncoming: 0,
          QtyPlanOutgoing: body.planQty,
          QtySOH: qtySoh,
          QtyAvailable: 0,
        },
        userBy,
        'WHSREVOUT',
      );
    }
  });

  return { data: { message: cst.messages.success }, httpCode: HTTP_STATUS.OK };
}
  /** A7 POST /picking (usp_UpdatePickingDate + SQS): SET PickingQty =
   *  actualQty (REPLACE; 0/null → default POQty — parity SP), PickingDate =
   *  now, barcode divalidasi vs detail (bila detail punya — picking tidak
   *  menulis barcode, parity legacy: barcode berasal dari input/sync master),
   *  SQS WHSOUT QtySOH = actualQty. Idempotent (re-submit overwrite). */
  async submitPicking(detailId: string, body: PickingDto, req: any) {
    const userBy = userOf(req);
    const detail = await this.detailRepository.getById(detailId);
    if (!detail) {
      throw new NotFoundException('Plan outgoing detail not found');
    }
    const headerId = detail.get('planOutgoingHeaderId') as string;
    const header = await this.repository.getById(headerId);
    if (!header) {
      throw new NotFoundException(cst.messages.notFound);
    }
    const status = header.get('status') as string | null;
    if (status === OUTGOING_STATUS.DRAFT || status === OUTGOING_STATUS.CANCELLED) {
      throw new BadRequestException('picking not allowed for Draft/Cancelled');
    }

    // barcode match — '0' = BYPASS (parity FE); longgar bila detail belum
    // punya barcode (master sync belum jalan)
    const isBypass = (v?: string) => !v || v === '0';
    const dbMaterial = (detail.get('materialBarcode') as string | null) ?? '';
    if (
      dbMaterial &&
      !isBypass(body.materialBarcode) &&
      dbMaterial !== body.materialBarcode
    ) {
      throw new BadRequestException('material barcode mismatch');
    }
    const dbLocation = (detail.get('materialLocationBarcode') as string | null) ?? '';
    if (
      dbLocation &&
      !isBypass(body.locationBarcode) &&
      dbLocation !== body.locationBarcode
    ) {
      throw new BadRequestException('location barcode mismatch');
    }

    const poQty = (detail.get('poQty') as number) ?? 0;
    // parity SP: CASE ISNULL(@ActualQty,0)=0 THEN POQty — 0/null → POQty
    const actualQty = body.actualQty ? body.actualQty : poQty;
    const now = nowWib();

    await sequelize.transaction(async (t) => {
      await this.detailRepository.update(
        detailId,
        {
          pickingQty: actualQty,
          pickingDate: now,
          modifiedDate: now,
          modifiedBy: userBy,
        },
        t,
      );

      await awsSqsThird.publishToInventory(
        {
          CustomerCode: (header.get('customerCode') as string) ?? null,
          CustomerName: (header.get('customerName') as string) ?? null,
          DeliveryNoteNo: (header.get('deliveryNoteNo') as string) ?? null,
          POType: (header.get('poType') as string) ?? null,
          PODate: header.get('poDate')
            ? new Date(header.get('poDate') as Date).toISOString()
            : null,
          WarehouseCode: (header.get('warehouseCode') as string) ?? null,
          WarehouseName: (header.get('warehouseName') as string) ?? null,
          MaterialCode: (detail.get('materialCode') as string) ?? null,
          MaterialName: (detail.get('materialName') as string) ?? null,
          MaterialBrand: (detail.get('materialBrand') as string) ?? null,
          UoM: (detail.get('uom') as string) ?? null,
          QtyPlanIncoming: 0,
          QtyPlanOutgoing: poQty,
          QtySOH: actualQty,
          QtyAvailable: 0,
        },
        userBy,
        'WHSOUT',
      );
    });

    // parity SP: SELECT TOP 1 header snapshot
    return {
      data: {
        customerCode: header.get('customerCode'),
        customerName: header.get('customerName'),
        warehouseCode: header.get('warehouseCode'),
        warehouseName: header.get('warehouseName'),
        qtySoh: actualQty,
        message: cst.messages.success,
      },
      httpCode: HTTP_STATUS.OK,
    };
  }
  /** A8 POST /packagings (usp_CreatePackaging): PackagingNo PER GRUP
   *  materialCode; nomor = PKG+8char random unik (parity generateShipmentNos
   *  ServiceOrder LOGIS); insert row per grup, set detail.packagingNo sesuai
   *  material, SEMUA header terkait → 'Packaging'. TANPA history (parity SP). */
  /** Generate `count` nomor {prefix}+8char unik (PKG/SHP) — batch random,
   *  SATU query existence-check (bukan N); retry hanya subset tabrakan.
   *  Parity generateShipmentNos di ServiceOrder LOGIS. */
  private async generateUniqueCodes(
    prefix: 'PKG' | 'SHP',
    count: number,
    transaction?: Transaction,
  ): Promise<string[]> {
    const MAX_RETRIES = 10;
    if (count <= 0) return [];

    const result = new Set<string>();
    let attempts = 0;
    while (result.size < count && attempts < count * MAX_RETRIES) {
      const needed = count - result.size;
      const candidates = Array.from(
        { length: needed },
        () => `${prefix}${UniqueIdGenerator.generate()}`,
      );
      attempts += needed;

      const novel = candidates.filter((no) => !result.has(no));
      if (novel.length === 0) continue;

      const existing = await this.packagingRepository.findExistingPackagingNos(
        novel,
        transaction,
      );
      const existingSet = new Set(existing);
      for (const no of novel) if (!existingSet.has(no)) result.add(no);
    }

    if (result.size < count) {
      throw new Error(
        `Failed to generate ${count} unique codes (${prefix}) after ${attempts} attempts`,
      );
    }
    return [...result];
  }

  async createPackagings(req: any) {
    const body = req.body as CreatePackagingDto;
    const userBy = userOf(req);
    const details = await this.detailRepository.findByIds(body.detailIds);
    if (details.length !== body.detailIds.length) {
      throw new NotFoundException('plan outgoing detail not found');
    }

    // guard: belum ber-packaging (destination beda BOLEH — tiap grup
    // material+destination bawa destination sendiri)
    const headerIds = [
      ...new Set(details.map((d) => d.get('planOutgoingHeaderId') as string)),
    ];
    const headers = await this.repository.findByIds(headerIds);
    if (details.some((d) => d.get('packagingNo'))) {
      throw new BadRequestException('alreadyPackaged');
    }

    // ponytail: merge grup per materialCode (Σ qty, lintas destination) —
    // kelompok FINAL per material, destination grup = kemunculan pertama
    const acc = new Map<string, any>();
    for (const row of body.packagings as any[]) {
      const prev = acc.get(row.materialCode);
      if (prev) prev.qty += row.qty;
      else acc.set(row.materialCode, { ...row });
    }
    const groups = [...acc.values()];

    // detail → grup materialnya (semua detail wajib punya grup)
    const detailIdsByCode = new Map<string, string[]>();
    for (const d of details) {
      const code = d.get('materialCode') as string;
      if (!acc.has(code)) {
        throw new BadRequestException('materialMismatch');
      }
      const ids = detailIdsByCode.get(code) ?? [];
      ids.push(d.get('id') as string);
      detailIdsByCode.set(code, ids);
    }

    const first = headers[0];
    const now = nowWib();
    const packagingNos = await this.generateUniqueCodes('PKG', groups.length);

    await sequelize.transaction(async (t) => {
      await this.packagingRepository.createMany(
        groups.map((row, i) => ({
          packagingNo: packagingNos[i],
          shipmentNo: null,
          customerDestination:
            row.customerDestination ??
            (first.get('customerDestination') as string | null),
          materialCode: row.materialCode,
          materialName: row.materialName ?? null,
          materialBrand: row.materialBrand ?? null,
          qty: row.qty,
          uom: row.uom ?? null,
          weight: row.weight ?? 0, // parity SP ISNULL(...,0)
          length: row.length ?? 0,
          width: row.width ?? 0,
          height: row.height ?? 0,
          isActive: true,
          createdDate: now,
          createdBy: userBy,
        })),
        t,
      );
      for (let i = 0; i < groups.length; i++) {
        await this.packagingRepository.setDetailPackagingNo(
          detailIdsByCode.get(groups[i].materialCode) ?? [],
          packagingNos[i],
          userBy,
          t,
        );
      }
      await this.repository.setStatusForIds(
        headerIds,
        OUTGOING_STATUS.PACKAGING,
        userBy,
        t,
      );
    });

    return {
      data: { packagingNos, message: cst.messages.success },
      httpCode: HTTP_STATUS.OK,
    };
  }

  /** A9 POST /ready-to-ship (usp_UpdateReadyToShip): 1 ShipmentNo utk grup
   *  packaging; header → 'Ready To Ship' HANYA bila SEMUA detail header sudah
   *  ber-packaging-ber-shipment (+history utk yang berubah saja). */
  async readyToShip(req: any) {
    const body = req.body as ReadyToShipDto;
    const userBy = userOf(req);
    const packagings = await this.packagingRepository.findByPackagingNos(
      body.packagingNos,
    );
    if (packagings.length !== body.packagingNos.length) {
      throw new NotFoundException('packaging not found');
    }

    const destinations = new Set(
      packagings.map((p) => p.get('customerDestination') ?? ''),
    );
    if (destinations.size > 1) {
      throw new BadRequestException('destinationMismatch');
    }

    const shipmentNo = (await this.generateUniqueCodes('SHP', 1))[0];

    await sequelize.transaction(async (t) => {
      await this.packagingRepository.setShipmentNos(
        body.packagingNos,
        shipmentNo,
        userBy,
        t,
      );

      // header terdampak + validasi semua detail ber-shipment
      const affectedDetails = await this.detailRepository.findByPackagingNos(
        body.packagingNos,
        t,
      );
      const headerIds = [
        ...new Set(
          affectedDetails.map((d) => d.get('planOutgoingHeaderId') as string),
        ),
      ];
      if (!headerIds.length) return;

      const allDetails = await this.detailRepository.findByHeaders(headerIds, t);
      const pkgNos = [
        ...new Set(
          allDetails
            .map((d) => d.get('packagingNo') as string | null)
            .filter((v): v is string => !!v),
        ),
      ];
      const allPkgs = pkgNos.length
        ? await this.packagingRepository.findByPackagingNos(pkgNos, t)
        : [];
      const shipped = new Set(
        allPkgs
          .filter((p) => !!p.get('shipmentNo'))
          .map((p) => p.get('packagingNo') as string),
      );

      const validHeaderIds = headerIds.filter((hid) =>
        allDetails
          .filter((d) => d.get('planOutgoingHeaderId') === hid)
          .every(
            (d) =>
              !!d.get('packagingNo') && shipped.has(d.get('packagingNo') as string),
          ),
      );

      if (validHeaderIds.length) {
        await this.repository.setStatusForIds(
          validHeaderIds,
          OUTGOING_STATUS.READY_TO_SHIP,
          userBy,
          t,
        );
        for (const hid of validHeaderIds) {
          await this.repository.insertHistory(
            hid,
            OUTGOING_STATUS.READY_TO_SHIP,
            userBy,
            t,
          );
        }
      }
    });

    return {
      data: { shipmentNo, message: cst.messages.success },
      httpCode: HTTP_STATUS.OK,
    };
  }
  /** A5 POST /statuses (usp_UpdateStatusOutgoingSequential + JS
   *  btnReadyToShipAHM): bulk Ready To Ship — valid = status Quality Control
   *  DAN semua detail POQty==PickingQty (indicator YES); invalid di-skip
   *  (+history utk yang di-update). */
  async bulkUpdateStatus(req: any) {
    const body = req.body as BulkStatusDto;
    const userBy = (req.body as any).userLogin ?? userOf(req);
    const headers = await this.repository.findByIds(body.ids);

    let updated = 0;
    const skipped: string[] = [];

    await sequelize.transaction(async (t) => {
      for (const header of headers) {
        const id = header.get('id') as string;
        const status = header.get('status') as string | null;
        const details = await this.detailRepository.findByHeader(id, t);
        const fullyPicked = details.every(
          (d) =>
            (d.get('poQty') as number) === ((d.get('pickingQty') as number) ?? 0),
        );

        if (status !== OUTGOING_STATUS.QUALITY_CONTROL || !fullyPicked) {
          skipped.push(
            (header.get('deliveryNoteNo') as string) ?? id,
          );
          continue;
        }

        await this.repository.updateHeader(
          id,
          {
            status: body.status,
            modifiedBy: userBy,
            modifiedDate: nowWib(),
          },
          t,
        );
        await this.repository.insertHistory(id, body.status, userBy, t);
        updated++;
      }
    });

    return {
      data: { updated, skipped, message: cst.messages.success },
      httpCode: HTTP_STATUS.OK,
    };
  }
}
