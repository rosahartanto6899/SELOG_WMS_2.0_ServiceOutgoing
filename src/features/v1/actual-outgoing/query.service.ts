import { inject, injectable } from 'inversify';
import { HTTP_STATUS } from '@/shared-libs/constants/http-status.constant';
import { Pagination } from '@/shared-libs/helpers/pagination.helper';
import { NotFoundException } from '@/shared-libs/exceptions';
import { ActualOutgoingRepository } from './repositories';

/** Q1–Q5 — read-only parity spec 005 (SP verified) */
@injectable()
export class QueryService {
  constructor(
    @inject(ActualOutgoingRepository)
    private readonly repository: ActualOutgoingRepository,
  ) {}

  /** Q1 GET / — list actual outgoing (usp_GetAllActualOutgoing parity) */
  async getAll(req: any) {
    const param = req.query;
    const page = param.page ?? 1;
    const limit = param.limit ?? 10;
    const { limit: size, offset } = Pagination.getPagination(page, limit);

    const { rows, total } = await this.repository.findAll({
      customerCode: param.customerCode,
      warehouseCode: param.warehouseCode,
      search: param.search,
      searchBy: param.searchBy,
      order: param.order,
      sort: param.sort,
      limit: size,
      offset,
    });

    return {
      page: {
        page: Number(page),
        limit: size,
        totalData: total,
        totalPage: Math.ceil(total / size),
        recordsTotal: total,
      },
      data: rows,
      httpCode: HTTP_STATUS.OK,
    };
  }

  /** Q2 GET /:id/details — header + details (+addInfo, shipmentNo,
   *  search material server-side via DTO whitelist) */
  async getDetails(id: string, query: any = {}) {
    const header = await this.repository.findDetailById(id, {
      search: query.search,
      searchBy: query.searchBy,
    });
    if (!header) throw new NotFoundException('Plan outgoing not found');
    const h = header.get({ plain: true }) as any;
    return {
      data: {
        id: h.id,
        deliveryNoteNo: h.deliveryNoteNo,
        outgoingDate: h.outgoingDate,
        referenceNo: h.referenceNo,
        materialCategory: h.materialCategory,
        poNo: h.poNo,
        poType: h.poType,
        poDate: h.poDate,
        description: h.description,
        customerDestination: h.customerDestination,
        picPicker: h.picPicker,
        picLoading: h.picLoading,
        status: h.status,
        addInfos: h.addInfos ?? [],
        details: (h.details ?? []).map((d: any) => ({
          id: d.id,
          shipmentNo: d.packaging?.shipmentNo ?? null,
          packagingNo: d.packagingNo,
          materialCode: d.materialCode,
          materialName: d.materialName,
          materialBrand: d.materialBrand,
          uom: d.uom,
          poQty: d.poQty,
          pickingQty: d.pickingQty ?? 0,
          pickingDate: d.pickingDate,
          description: d.description,
          modifiedBy: d.modifiedBy,
          addInfos: d.addInfos ?? [],
        })),
      },
      httpCode: HTTP_STATUS.OK,
    };
  }

  /** Q3 GET /:id/history — parity Q8 outstanding: leadtime direcompute saat
   *  read (diff dua Date TZ-parse sama selalu akurat; menyembuhkan baris lama) */
  async getHistory(id: string) {
    const rows = await this.repository.findHistory(id);
    let prev: Date | null = null;
    return {
      data: rows.map((row) => {
        const h = row.get({ plain: true });
        const leadtime = prev
          ? Math.floor(((h.date?.getTime() ?? 0) - prev.getTime()) / 60000) + 1
          : (h.leadtime ?? 0);
        prev = h.date ?? prev;
        return {
          id: h.id,
          status: h.status,
          date: h.date,
          leadtime,
          pic: h.pic,
          createdAt: h.createdDate,
          createdBy: h.createdBy,
        };
      }),
      httpCode: HTTP_STATUS.OK,
    };
  }

  /** Q4 GET /:id/add-info — header add-info rows */
  async getAddInfoHeader(id: string) {
    const rows = await this.repository.findAddInfoHeader(id);
    return {
      data: rows.map((r) => {
        const h = r.get({ plain: true });
        return { name: h.name, value: h.value };
      }),
      httpCode: HTTP_STATUS.OK,
    };
  }

  /** Q5 GET /detail/:detailId/add-info — detail add-info rows */
  async getAddInfoDetail(detailId: string) {
    const rows = await this.repository.findAddInfoDetail(detailId);
    return {
      data: rows.map((r) => {
        const h = r.get({ plain: true });
        return { name: h.name, value: h.value };
      }),
      httpCode: HTTP_STATUS.OK,
    };
  }
}
