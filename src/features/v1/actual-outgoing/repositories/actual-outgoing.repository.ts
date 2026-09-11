import { injectable } from 'inversify';
import { Op, Order, WhereOptions } from 'sequelize';
import {
  PlanOutgoingHeader,
  PlanOutgoingDetail,
  PlanOutgoingHeaderAddInfo,
  PlanOutgoingDetailAddInfo,
  PlanOutgoingPackaging,
  PlanOutgoingHistory,
} from '@/database/entities';
import { nowWib } from '@/utils';
import {
  ACTUAL_ADJUSTMENT_QC,
  ACTUAL_INCLUDE_STATUS,
  ACTUAL_LIST_ORDER_WHITELIST,
  ACTUAL_LIST_SEARCH_COLUMNS,
  actualOutgoingConstant as cst,
} from '../constants';

/** Row header list actual (Q1) */
export interface ActualListRow {
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
  createdDate: Date;
  createdBy: string;
}

/**
 * Query read-only modul Actual Outgoing (spec 005) — parity SP
 * usp_GetAllActualOutgoing: filter status verbatim + cutoff CreatedDate
 * 2 bulan (frame WIB) + customer/warehouse exact. TANPA mutasi apa pun.
 */
@injectable()
export class ActualOutgoingRepository {
  /** Base WHERE SP (dipakai rows & count) */
  private baseWhere(customerCode?: string, warehouseCode?: string) {
    const cutoff = nowWib();
    cutoff.setMonth(cutoff.getMonth() - 2); // DATEADD(MONTH,-2, +7h UTC)

    const where: WhereOptions = {
      isActive: true,
      createdDate: { [Op.gte]: cutoff },
      // SP: Status IN (...) OR (POType='Adjustment' AND Status='Quality Control')
      [Op.or]: [
        { status: { [Op.in]: [...ACTUAL_INCLUDE_STATUS] } },
        { ...ACTUAL_ADJUSTMENT_QC },
      ],
    };
    if (customerCode) where.customerCode = customerCode;
    if (warehouseCode) where.warehouseCode = warehouseCode;
    return where;
  }

  /** Q1 — rows + total (paging server-side) */
  public async findAll(
    param: {
      customerCode?: string;
      warehouseCode?: string;
      search?: string;
      searchBy?: string;
      order?: string;
      sort?: string;
      limit: number;
      offset: number;
    },
  ): Promise<{ rows: ActualListRow[]; total: number }> {
    const where: WhereOptions = this.baseWhere(
      param.customerCode,
      param.warehouseCode,
    );

    if (param.search) {
      const like = `%${param.search}%`;
      if (param.searchBy) {
        // pola LOGIS: LIKE satu kolom (whitelist DTO)
        (where as any)[param.searchBy] = { [Op.like]: like };
      } else {
        // SP legacy: LIKE gabung 6 kolom
        (where as any)[Op.or as unknown as string] = ACTUAL_LIST_SEARCH_COLUMNS.map(
          (column) => ({ [column]: { [Op.like]: like } }),
        );
      }
    }

    const orderColumn =
      ACTUAL_LIST_ORDER_WHITELIST[param.order ?? cst.defaultSort] ??
      ACTUAL_LIST_ORDER_WHITELIST[cst.defaultSort]; // parity SP: DeliveryNoteNo
    const sort = param.sort === 'asc' ? 'ASC' : 'DESC';
    const order: Order = [[orderColumn, sort]];

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
        'createdDate',
        'createdBy',
      ],
      where,
      order,
      limit: param.limit,
      offset: param.offset,
    });
    const total = await PlanOutgoingHeader.count({ where });
    return { rows: rows.map((r) => r.get({ plain: true })) as ActualListRow[], total };
  }

  /** Q2 — header + details (+addInfo & shipmentNo via packaging);
   *  search: LIKE satu kolom detail (whitelist DTO, shipmentNo nested) */
  public async findDetailById(
    id: string,
    search?: { search?: string; searchBy?: string },
  ) {
    const detailWhere: WhereOptions = {};
    if (search?.search && search?.searchBy) {
      const like = { [Op.like]: `%${search.search}%` };
      // ponytail: nested key '$packaging.shipmentNo$' — Sequelize v6 join where,
      // ganti subquery terpisah kalau butuh index-tuned search besar.
      (detailWhere as any)[
        search.searchBy === 'shipmentNo'
          ? '$packaging.shipmentNo$'
          : search.searchBy
      ] = like;
    }
    return PlanOutgoingHeader.findOne({
      where: { id },
      include: [
        {
          model: PlanOutgoingDetail,
          as: 'details',
          where: detailWhere,
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

  /** Q3 — history (parity Q8 outstanding; leadtime direcompute saat read) */
  public async findHistory(headerId: string) {
    return PlanOutgoingHistory.findAll({
      where: { planOutgoingHeaderId: headerId },
      order: [['date', 'ASC']],
    });
  }

  /** Q4 — add-info header */
  public async findAddInfoHeader(headerId: string) {
    return PlanOutgoingHeaderAddInfo.findAll({
      where: { planOutgoingHeaderId: headerId },
      order: [['createdDate', 'ASC']],
    });
  }

  /** Q5 — add-info detail */
  public async findAddInfoDetail(detailId: string) {
    return PlanOutgoingDetailAddInfo.findAll({
      where: { planOutgoingDetailId: detailId },
      order: [['createdDate', 'ASC']],
    });
  }
}
