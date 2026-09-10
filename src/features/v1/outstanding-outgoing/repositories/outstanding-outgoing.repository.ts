import { injectable } from 'inversify';
import { col, fn, literal, Op, Order, Transaction, WhereOptions } from 'sequelize';
import {
  PlanOutgoingHeader,
  PlanOutgoingHeaderAddInfo,
  PlanOutgoingDetail,
  PlanOutgoingDetailAddInfo,
  PlanOutgoingHistory,
  PlanOutgoingPackaging,
} from '@/database/entities';
import { PlanOutgoingHeaderAttributes } from '@/database/attributes';
import { nowWib } from '@/utils';
import { TOTALS_STATUS, filterAddInfos, leadtimeMinutes } from '../constants';

/** Row header untuk list outstanding (Q1) — parity usp_GetAllDataOutstandingOutgoing */
export interface ListRow {
  id: string;
  deliveryNoteNo: string;
  outgoingDate: Date | null;
  poNo: string;
  poType: string | null;
  poDate: Date | null;
  customerDestination: string | null;
  referenceNo: string | null;
  description: string | null;
  status: string | null;
  isActive: boolean;
  createdDate: Date;
  createdBy: string | null;
  isHold: boolean | null;
}

/** Header CRUD + add-info replace (C1/C3/C6) + worklist list (Q1, spec 004) */
@injectable()
export class OutstandingOutgoingRepository {
  /** Q1 — rows header + LEFT JOIN detail (filter materialCode advanced) */
  public async findAll(
    headerWhere: WhereOptions,
    detailWhere: WhereOptions | null,
    order: Order,
    limit: number,
    offset: number,
  ): Promise<ListRow[]> {
    const rows = await PlanOutgoingHeader.findAll({
      attributes: [
        'id',
        'deliveryNoteNo',
        'outgoingDate',
        'poNo',
        'poType',
        'poDate',
        'customerDestination',
        'referenceNo',
        'description',
        'status',
        'isActive',
        'createdDate',
        'createdBy',
        'isHold',
      ],
      where: headerWhere,
      include: detailWhere
        ? [
            {
              model: PlanOutgoingDetail,
              as: 'details',
              attributes: ['id'],
              where: detailWhere,
              required: true,
            },
          ]
        : [],
      order,
      limit,
      offset,
      subQuery: false,
    });
    return rows.map((r) => r.get({ plain: true })) as ListRow[];
  }

  /** Q1 — COUNT DISTINCT header (recordsTotal & recordsFiltered) */
  public async countAll(
    headerWhere: WhereOptions,
    detailWhere: WhereOptions | null,
  ): Promise<number> {
    return await PlanOutgoingHeader.count({
      distinct: true,
      col: 'id',
      where: headerWhere,
      include: detailWhere
        ? [
            {
              model: PlanOutgoingDetail,
              as: 'details',
              attributes: [],
              where: detailWhere,
              required: true,
            },
          ]
        : [],
    });
  }

  /** Q1 — jumlah detail POQty≠PickingQty per header (indikator per-baris,
   *  parity usp_CheckIndicatorOutgoing: YES = tidak ada baris mismatch) */
  public async findMismatchByHeaderIds(ids: string[]) {
    if (!ids.length) return [];
    return PlanOutgoingDetail.findAll({
      attributes: [
        'planOutgoingHeaderId',
        [
          fn(
            'SUM',
            literal(`CASE WHEN ISNULL(POQty,0) <> ISNULL(PickingQty,0) THEN 1 ELSE 0 END`),
          ),
          'mismatch',
        ],
      ],
      where: { planOutgoingHeaderId: { [Op.in]: ids } },
      group: ['planOutgoingHeaderId'],
      raw: true,
    });
  }

  /** Q10 — grand total outstanding (usp_GetAllOutstandingByWarehouseCode) */
  public async countTotals(warehouseCodes: string[]): Promise<number> {
    return PlanOutgoingHeader.count({
      where: this.totalsWhere(warehouseCodes),
    });
  }

  /** Q11 — total per warehouse (usp_GetTotalDetailOutstandingByWarehouseCode) */
  public async countTotalsByWarehouse(warehouseCodes: string[]) {
    return PlanOutgoingHeader.findAll({
      attributes: [
        [fn('COUNT', '*'), 'totalDataOutstanding'],
        'warehouseCode',
        'warehouseName',
      ],
      where: this.totalsWhere(warehouseCodes),
      group: ['warehouseCode', 'warehouseName'],
      raw: true,
    });
  }

  /** Totals filter verified SP: 4 status ATAU (QC dan bukan Adjustment);
   *  @CustomerCode diabaikan SP (parity). */
  private totalsWhere(warehouseCodes: string[]): WhereOptions {
    return {
      isActive: true,
      warehouseCode: { [Op.in]: warehouseCodes },
      [Op.or]: [
        { status: { [Op.in]: [...TOTALS_STATUS] } },
        {
          status: 'Quality Control',
          poType: { [Op.ne]: 'Adjustment' },
        },
      ],
    };
  }

  /** Q12 — detail mismatch utuh per customer+warehouse exact (parity SP,
   *  dipakai mode sequential Fase 6; rows [{headerId, poQty, pickingQty}]) */
  public async findMismatchByCustomerWarehouse(
    customerCode: string,
    warehouseCode: string,
  ) {
    return PlanOutgoingDetail.findAll({
      attributes: ['planOutgoingHeaderId', 'poQty', 'pickingQty'],
      include: [
        {
          model: PlanOutgoingHeader,
          as: 'header',
          attributes: [],
          where: { customerCode, warehouseCode, isActive: true },
          required: true,
        },
      ],
      where: { poQty: { [Op.ne]: col('pickingQty') } },
      raw: true,
    });
  }

  public async getById(id: string, transaction?: Transaction) {
    return PlanOutgoingHeader.findByPk(id, { transaction });
  }

  /** A8/A9 — bulk update status beberapa header */
  public async setStatusForIds(
    ids: string[],
    status: string,
    userBy: string,
    transaction?: Transaction,
  ) {
    await PlanOutgoingHeader.update(
      { status, modifiedBy: userBy, modifiedDate: nowWib() },
      { where: { id: { [Op.in]: ids } }, transaction },
    );
  }

  /** A1/A2/A3 — bulk fetch by ids */
  public async findByIds(ids: string[], transaction?: Transaction) {
    return PlanOutgoingHeader.findAll({
      where: { id: { [Op.in]: ids } },
      transaction,
    });
  }

  /** Insert satu baris history (leadtime menit +1 parity SP — formula sama
   *  dgn outstanding-incoming: diff wall-clock, bukan epoch mentah) */
  public async insertHistory(
    headerId: string,
    status: string,
    pic: string,
    transaction?: Transaction,
  ): Promise<void> {
    const now = nowWib();
    const last = await PlanOutgoingHistory.findOne({
      where: { planOutgoingHeaderId: headerId },
      order: [['date', 'DESC']],
      transaction,
    });
    const lastDate = (last?.get('date') as Date | null) ?? null;
    await PlanOutgoingHistory.create(
      {
        planOutgoingHeaderId: headerId,
        status,
        date: now,
        leadtime: leadtimeMinutes(lastDate, now),
        pic,
        createdDate: now,
        createdBy: pic,
      },
      { transaction },
    );
  }

  /** Q8 — history per header (parity usp_GetPlanOutgoingHistory) */
  public async findHistory(headerId: string) {
    return PlanOutgoingHistory.findAll({
      where: { planOutgoingHeaderId: headerId },
      order: [['date', 'ASC']],
    });
  }

  public async getByDeliveryNoteNo(
    deliveryNoteNo: string,
    transaction?: Transaction,
    lock = false,
  ) {
    // parity SP incoming: EXISTS semua header dengan DN sama (termasuk soft-deleted)
    return PlanOutgoingHeader.findOne({
      where: { deliveryNoteNo },
      transaction,
      ...(lock && transaction ? { lock } : {}),
    });
  }

  /** C6/Q7 — header + details (+add-info masing-masing; detail + shipmentNo
   *  dari packaging via asosiasi string packagingNo — parity usp_GetPlanOutgoingDetail) */
  public async findDetailById(id: string) {
    return PlanOutgoingHeader.findOne({
      where: { id },
      include: [
        {
          model: PlanOutgoingDetail,
          as: 'details',
          include: [
            { model: PlanOutgoingDetailAddInfo, as: 'addInfos', separate: true },
            {
              model: PlanOutgoingPackaging,
              as: 'packaging',
              attributes: ['shipmentNo'],
            },
          ],
        },
        { model: PlanOutgoingHeaderAddInfo, as: 'addInfos', separate: true },
      ],
    });
  }

  public async createHeader(
    data: PlanOutgoingHeaderAttributes,
    transaction?: Transaction,
  ) {
    return PlanOutgoingHeader.create(data, { transaction });
  }

  public async updateHeader(
    id: string,
    data: Partial<PlanOutgoingHeaderAttributes>,
    transaction?: Transaction,
  ) {
    await PlanOutgoingHeader.update(data, { where: { id }, transaction });
  }

  /** Add-info header replace: hard-delete lama + insert baru (parity SP) */
  public async replaceHeaderAddInfos(
    headerId: string,
    rows: Array<{ name?: string; value?: string }>,
    userBy: string,
    transaction?: Transaction,
  ): Promise<void> {
    await PlanOutgoingHeaderAddInfo.destroy({
      where: { planOutgoingHeaderId: headerId },
      transaction,
    });
    const now = nowWib();
    for (const row of filterAddInfos(rows)) {
      await PlanOutgoingHeaderAddInfo.create(
        {
          planOutgoingHeaderId: headerId,
          name: row.name,
          value: row.value,
          createdDate: now,
          createdBy: userBy,
        },
        { transaction },
      );
    }
  }
}
