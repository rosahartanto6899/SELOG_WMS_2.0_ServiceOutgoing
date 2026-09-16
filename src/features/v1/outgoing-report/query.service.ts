import { inject, injectable } from 'inversify';
import { Op, Order, WhereOptions } from 'sequelize';
import { HTTP_STATUS } from '@/shared-libs/constants/http-status.constant';
import { Pagination } from '@/shared-libs/helpers/pagination.helper';
import { OutgoingReportRepository } from './repositories';
import { PlanOutgoingHeader } from '@/database/entities';
import {
  OUTGOING_REPORT_ORDER_WHITELIST,
} from './constants';

/** GET / — Outgoing Report (parity CoreApp Report/OutgoingReport).
 *  Filter tanggal pada header.poDate (kolom tanggal satu-satunya di report
 *  legacy; ganti 1 baris bila SP ternyata memakai outgoingDate). */
@injectable()
export class QueryService {
  constructor(
    @inject(OutgoingReportRepository)
    private readonly repository: OutgoingReportRepository,
  ) {}

  async getAll(req: any) {
    const param = req.query;
    const page = Number(param.page ?? 1);
    const limit = Number(param.limit ?? 10);
    const { limit: size, offset } = Pagination.getPagination(page, limit);

    // tenant + gudang aktif dari token session, bukan input FE (pola 2.0;
    // legacy mengirim CustomerCode/WarehouseCode dari session FE)
    const headerWhere: WhereOptions = {
      isActive: true,
    };
    if (req.user?.tokenCustomerCode) {
      headerWhere.customerCode = req.user.tokenCustomerCode;
    }
    if (req.user?.tokenWarehouseCode) {
      headerWhere.warehouseCode = req.user.tokenWarehouseCode;
    }

    // rentang poDate inklusif [startDate 00:00, endDate 23:59:59.999]
    headerWhere.poDate = {
      [Op.gte]: new Date(`${param.startDate}T00:00:00`),
      [Op.lte]: new Date(`${param.endDate}T23:59:59.999`),
    };

    // gate report = sudah dipicking (pickingQty > 0), BUKAN status:
    // data live 2026-09-15 — Picking 65/66 & Packaging 12/12 detail sudah
    // picked tapi ter-exclude oleh status; qty adalah sumber kebenaran
    const detailWhere: WhereOptions = {
      pickingQty: { [Op.gt]: 0 },
    };

    // recordsTotal: tanpa search
    const recordsTotal = await this.repository.countAll(headerWhere, detailWhere);

    // recordsFiltered: + search LIKE gabung 4 kolom (3 detail + deliveryNoteNo
    //    header via nested reference $header.)
    if (param.search) {
      const like = { [Op.like]: `%${param.search}%` };
      const or: Record<string, unknown>[] = [];
      if (!param.searchBy || param.searchBy === 'deliveryNoteNo') {
        or.push({ '$header.deliveryNoteNo$': like });
      }
      for (const column of ['materialCode', 'materialName', 'materialBrand']) {
        if (!param.searchBy || param.searchBy === column) {
          or.push({ [column]: like });
        }
      }
      detailWhere[Op.or as unknown as string] = or;
    }
    const recordsFiltered = await this.repository.countAll(
      headerWhere,
      detailWhere,
    );

    const orderColumn =
      OUTGOING_REPORT_ORDER_WHITELIST[param.order ?? 'poDate'] ?? 'poDate';
    const sort = param.sort === 'asc' ? 'ASC' : 'DESC';
    // kolom header di-sort lewat include; kolom detail langsung
    const order: Order =
      orderColumn === 'poDate' || orderColumn === 'deliveryNoteNo'
        ? [[{ model: PlanOutgoingHeader, as: 'header' }, orderColumn, sort]]
        : [[orderColumn, sort]];

    const rows = await this.repository.findAll(
      headerWhere,
      detailWhere,
      order,
      size,
      offset,
    );

    return {
      page: {
        page: Number(page),
        limit: size,
        totalData: recordsFiltered,
        totalPage: Math.ceil(recordsFiltered / size),
        recordsTotal,
      },
      data: rows.map((r) => ({
        id: r.id,
        materialCode: r.materialCode,
        materialName: r.materialName,
        materialBrand: r.materialBrand,
        uom: r.uom,
        actualQty: Number(r.pickingQty ?? 0),
        deliveryNoteNo: r.header?.deliveryNoteNo,
        poDate: r.header?.poDate,
      })),
      httpCode: HTTP_STATUS.OK,
    };
  }
}
