import { inject, injectable } from 'inversify';
import { Transaction } from 'sequelize';
import { HTTP_STATUS } from '@/shared-libs/constants/http-status.constant';
import {
  BadRequestException,
  NotFoundException,
} from '@/shared-libs/exceptions';
import { IDataUser } from '@/shared-libs/interfaces/user-data.interface';
import { sequelize, nowWib } from '@/utils';
import {
  OutstandingOutgoingRepository,
  PlanOutgoingDetailRepository,
} from './repositories';
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
}
