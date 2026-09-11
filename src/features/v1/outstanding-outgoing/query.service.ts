import { inject, injectable } from 'inversify';
import { Op, Order, WhereOptions } from 'sequelize';
import { HTTP_STATUS } from '@/shared-libs/constants/http-status.constant';
import { Pagination } from '@/shared-libs/helpers/pagination.helper';
import { NotFoundException } from '@/shared-libs/exceptions';
import {
  OutstandingOutgoingRepository,
  PlanOutgoingDetailRepository,
} from './repositories';
import { PlanOutgoingPackagingRepository } from './repositories/plan-outgoing-packaging.repository';
import { ByIdTransform, GetOutstandingListTransform } from './transforms';
import {
  ADJUSTMENT_QC_EXCLUDE,
  LIST_ORDER_WHITELIST,
  LIST_SEARCH_COLUMNS,
  OUTSTANDING_EXCLUDE_STATUS,
} from './constants';

/** Query read — C6 edit + Q1–Q4/Q10–Q12 worklist (spec 004) */
@injectable()
export class QueryService {
  constructor(
    @inject(OutstandingOutgoingRepository)
    private readonly repository: OutstandingOutgoingRepository,
    @inject(PlanOutgoingPackagingRepository)
    private readonly packagingRepository: PlanOutgoingPackagingRepository,
    @inject(PlanOutgoingDetailRepository)
    private readonly detailRepository: PlanOutgoingDetailRepository,
  ) {}

  /** Q1 GET / — list DN outstanding (usp_GetAllDataOutstandingOutgoing) */
  async getAll(req: any) {
    const param = req.query;
    const page = param.page ?? 1;
    const limit = param.limit ?? 10;
    const { limit: size, offset } = Pagination.getPagination(page, limit);

    const baseWhere: WhereOptions = {
      isActive: true,
      status: { [Op.notIn]: [...OUTSTANDING_EXCLUDE_STATUS] },
      [Op.not]: ADJUSTMENT_QC_EXCLUDE, // NOT (Adjustment AND QC) — verified SP
    };
    if (param.customerCode) {
      baseWhere.customerCode = { [Op.like]: `%${param.customerCode}%` };
    }
    if (param.warehouseCode) {
      baseWhere.warehouseCode = { [Op.like]: `%${param.warehouseCode}%` };
    }

    // advanced searchBy materialCode → exact di detail (parity SP @MaterialCode)
    const detailWhere: WhereOptions | null =
      param.searchBy === 'materialCode' && param.search
      ? { materialCode: param.search }
      : null;

    const recordsTotal = await this.repository.countAll(baseWhere, detailWhere);

    const filteredWhere: WhereOptions = { ...baseWhere };
    if (param.deliveryNoteNoFilter) {
      filteredWhere.deliveryNoteNo = {
        [Op.like]: `%${param.deliveryNoteNoFilter}%`,
      };
    }
    if (param.search) {
      const like = `%${param.search}%`;
      if (param.searchBy === 'materialCode') {
        // sudah di detailWhere; search header diabaikan (parity popup legacy)
      } else if (param.searchBy) {
        filteredWhere[param.searchBy] = { [Op.like]: like };
      } else {
        filteredWhere[Op.or as unknown as string] = LIST_SEARCH_COLUMNS.map(
          (column) => ({ [column]: { [Op.like]: like } }),
        );
      }
    }
    const recordsFiltered = await this.repository.countAll(
      filteredWhere,
      detailWhere,
    );

    const orderColumn =
      LIST_ORDER_WHITELIST[param.order ?? 'createdAt'] ?? 'createdDate';
    const sort = param.sort === 'asc' ? 'ASC' : 'DESC';
    const order: Order = [[orderColumn, sort]];

    const rows = await this.repository.findAll(
      filteredWhere,
      detailWhere,
      order,
      size,
      offset,
    );

    // indikator per baris (1 query per page — parity CheckIndicator)
    const sums = await this.repository.findMismatchByHeaderIds(
      rows.map((r) => r.id),
    );
    const mismatchById = new Map(
      sums.map((s: any) => [s.planOutgoingHeaderId, Number(s.mismatch ?? 0)]),
    );
    const rowsWithIndicator = rows.map((r: any) => ({
      ...r,
      mismatch: mismatchById.get(r.id) ?? 0,
    }));

    return {
      page: {
        page: Number(page),
        limit: size,
        totalData: recordsFiltered,
        totalPage: Math.ceil(recordsFiltered / size),
        recordsTotal,
      },
      data: new GetOutstandingListTransform().array(rowsWithIndicator),
      httpCode: HTTP_STATUS.OK,
    };
  }

  /** Q2 GET /items — DN items sudah dipicking & belum ber-packaging
   *  (tab DN Items, server-side parity Q1) */
  async getItems(req: any) {
    const param = req.query;
    const page = param.page ?? 1;
    const limit = param.limit ?? 10;
    const { limit: size, offset } = Pagination.getPagination(page, limit);
    const HEADER_COLS = new Set(['deliveryNoteNo', 'poNo', 'customerDestination']);

    const { rows, total } = await this.packagingRepository.findItems({
      customerCode: param.customerCode,
      warehouseCode: param.warehouseCode,
      search: param.search,
      searchBy: param.searchBy,
      order: HEADER_COLS.has(param.order ?? '')
        ? param.order
        : param.order === 'createdAt'
          ? 'createdAt'
          : (param.order ?? 'createdAt'),
      sort: param.sort === 'asc' ? 'ASC' : 'DESC',
      limit: size,
      offset,
    });

    return {
      page: {
        page: Number(page),
        limit: size,
        totalData: total,
        totalPage: Math.ceil(total / size),
      },
      data: rows.map((row: any) => ({
        id: row.id,
        deliveryNoteNo: row['header.deliveryNoteNo'],
        poNo: row['header.poNo'],
        materialBarcode: row.materialBarcode ?? null,
        materialCode: row.materialCode,
        materialName: row.materialName,
        materialBrand: row.materialBrand,
        uom: row.uom,
        poQty: row.poQty,
        pickingQty: row.pickingQty ?? 0,
        customerDestination: row['header.customerDestination'],
        status: row['header.status'],
        createdAt: row['header.createdDate'],
      })),
      httpCode: HTTP_STATUS.OK,
    };
  }

  /** Q3 GET /packagings — tab Packaging (server-side parity Q2) */
  async getPackagings(req: any) {
    const param = req.query;
    const page = param.page ?? 1;
    const limit = param.limit ?? 10;
    const { limit: size, offset } = Pagination.getPagination(page, limit);

    const { rows, total } = await this.packagingRepository.findPackagings({
      customerCode: param.customerCode,
      warehouseCode: param.warehouseCode,
      search: param.search,
      searchBy: param.searchBy,
      order: param.order ?? 'createdAt',
      sort: param.sort === 'asc' ? 'ASC' : 'DESC',
      limit: size,
      offset,
    });

    return {
      page: {
        page: Number(page),
        limit: size,
        totalData: total,
        totalPage: Math.ceil(total / size),
      },
      data: rows.map((row: any) => {
        // raw query → plain object (bukan instance Sequelize)
        const p = row.get ? row.get({ plain: true }) : row;
        return {
          id: p.id,
          packagingNo: p.packagingNo,
          customerDestination: p.customerDestination,
          materialCode: p.materialCode,
          materialName: p.materialName,
          materialBrand: p.materialBrand,
          qty: p.qty,
          uom: p.uom,
          weight: p.weight,
          length: p.length,
          width: p.width,
          height: p.height,
          shipmentNo: p.shipmentNo,
          createdAt: p.createdDate,
        };
      }),
      httpCode: HTTP_STATUS.OK,
    };
  }

  /** Q4 GET /shipments — tab Shipment (server-side parity Q2/Q3) */
  async getShipments(req: any) {
    const param = req.query;
    const page = param.page ?? 1;
    const limit = param.limit ?? 10;
    const { limit: size, offset } = Pagination.getPagination(page, limit);

    const { rows, total } = await this.packagingRepository.findShipments({
      customerCode: param.customerCode,
      warehouseCode: param.warehouseCode,
      search: param.search,
      searchBy: param.searchBy,
      order: param.order ?? 'modifiedDate',
      sort: param.sort === 'asc' ? 'ASC' : 'DESC',
      limit: size,
      offset,
    });

    return {
      page: {
        page: Number(page),
        limit: size,
        totalData: total,
        totalPage: Math.ceil(total / size),
      },
      data: rows.map((row: any) => ({
        shipmentNo: row.shipmentNo,
        customerDestination: row.customerDestination,
        modifiedDate: row.modifiedDate,
      })),
      httpCode: HTTP_STATUS.OK,
    };
  }

  /** Q10 POST /totals — grand total outstanding */
  async getTotals(req: any) {
    const { warehouseCodes } = req.body;
    const totalDataOutstanding = await this.repository.countTotals(
      warehouseCodes,
    );
    return { data: { totalDataOutstanding }, httpCode: HTTP_STATUS.OK };
  }

  /** Q11 POST /totals/by-warehouse — rincian per warehouse */
  async getTotalsByWarehouse(req: any) {
    const { warehouseCodes } = req.body;
    const rows = await this.repository.countTotalsByWarehouse(warehouseCodes);
    return {
      data: rows.map((row: any) => ({
        totalDataOutstanding: Number(row.totalDataOutstanding ?? 0),
        warehouseCode: row.warehouseCode,
        warehouseName: row.warehouseName,
      })),
      httpCode: HTTP_STATUS.OK,
    };
  }

  /** Q12 POST /indicator — detail mismatch parity usp_CheckIndicatorOutgoing */
  async checkIndicator(req: any) {
    const { customerCode, warehouseCode } = req.body;
    const rows = await this.repository.findMismatchByCustomerWarehouse(
      customerCode,
      warehouseCode,
    );
    return {
      data: rows.map((row: any) => ({
        planOutgoingHeaderId: row.planOutgoingHeaderId,
        poQty: row.poQty,
        pickingQty: row.pickingQty,
      })),
      httpCode: HTTP_STATUS.OK,
    };
  }

  /** C6 GET /:id/edit — data form edit + flag bisa-edit per detail */
  async getEdit(id: string) {
    return this.getDetailsById(id);
  }

  /** Q7 GET /:id/details — data view detail (shape sama C6) */
  async getDetails(id: string) {
    return this.getDetailsById(id);
  }

  private async getDetailsById(id: string) {
    const header = await this.repository.findDetailById(id);
    if (!header) {
      throw new NotFoundException('Plan outgoing not found');
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

  /** A10 GET /sequential-config — flag sequential per customer.
   *  ponytail: tabel SequentialProcessConf ada di DB master data yang TIDAK
   *  diekspos ServiceMasterData (verified) → sumber = env SEQUENTIAL_CUSTOMERS
   *  (CSV customerCode, dev); ganti ke panggilan master data saat endpoint
   *  tersedia. */
  async getSequentialConfig(customerCode: string) {
    const list = (process.env.SEQUENTIAL_CUSTOMERS ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    return {
      data: { isSequentialProcess: list.includes(customerCode) },
      httpCode: HTTP_STATUS.OK,
    };
  }

  /** Q15 GET /:id/picking-slip — data cetak (parity usp_GetPrintDataPickingSlip) */
  async getPickingSlip(id: string) {
    const header = await this.repository.getById(id);
    if (!header) {
      throw new NotFoundException('Plan outgoing not found');
    }
    const details = await this.detailRepository.findByHeader(id);
    return {
      data: details.map((d) => {
        const r = d.get({ plain: true }) as any;
        return {
          id: r.id,
          customerCode: header.get('customerCode'),
          customerName: header.get('customerName'),
          warehouseCode: header.get('warehouseCode'),
          warehouseName: header.get('warehouseName'),
          customerDestination: header.get('customerDestination'),
          referenceNo: header.get('referenceNo'),
          poNo: header.get('poNo'),
          materialCode: r.materialCode,
          materialName: r.materialName,
          partNumber: r.materialName,
          description: r.description,
          brand: r.materialBrand,
          qty: r.poQty,
          satuan: r.uom,
          loc: r.materialLocationBarcode ?? 0,
          remark: 'remark',
        };
      }),
      httpCode: HTTP_STATUS.OK,
    };
  }


  /** Q5 GET /packagings/:packagingNo/pos — PO pembentuk packaging
   *  (usp_GetAllDataPOByPackagingNo); server-side paging/search/sort. */
  async getPosByPackagingNo(req: any) {
    const packagingNo = req.params.packagingNo;
    const param = req.query;
    const page = param.page ?? 1;
    const limit = param.limit ?? 10;
    const { limit: size, offset } = Pagination.getPagination(page, limit);

    const { rows, total } = await this.packagingRepository.findPosByPackagingNo(
      packagingNo,
      {
        search: param.search,
        searchBy: param.searchBy,
        order: param.order ?? 'materialCode',
        sort: param.sort === 'asc' ? 'ASC' : 'DESC',
        limit: size,
        offset,
      },
    );

    return {
      page: {
        page: Number(page),
        limit: size,
        totalData: total,
        totalPage: Math.ceil(total / size),
      },
      data: rows.map((row: any) => ({
        deliveryNoteNo: row['header.deliveryNoteNo'],
        poNo: row['header.poNo'],
        poType: row['header.poType'],
        poDate: row['header.poDate'],
        customerDestination: row['header.customerDestination'],
        materialCode: row.materialCode,
        materialName: row.materialName,
        materialBrand: row.materialBrand,
        uom: row.uom,
        poQty: row.poQty,
        pickingQty: row.pickingQty,
        pickingDate: row.pickingDate,
      })),
      httpCode: HTTP_STATUS.OK,
    };
  }

  /** Q6 GET /shipments/:shipmentNo/packagings — packaging per shipment
   *  (usp_GetAllDataPackagingByShipmentNo, DISTINCT → dedupe manual);
   *  server-side paging/search/sort. ponytail: dedupe SETELAH paging —
   *  halaman bisa < limit kalau ada duplikat; fix sebenarnya DISTINCT di SQL. */
  async getPackagingsByShipmentNo(req: any) {
    const shipmentNo = req.params.shipmentNo;
    const param = req.query;
    const page = param.page ?? 1;
    const limit = param.limit ?? 10;
    const { limit: size, offset } = Pagination.getPagination(page, limit);

    const { rows, total } = await this.packagingRepository.findByShipmentNo(
      shipmentNo,
      {
        search: param.search,
        searchBy: param.searchBy,
        order: param.order ?? 'packagingNo',
        sort: param.sort === 'asc' ? 'ASC' : 'DESC',
        limit: size,
        offset,
      },
    );

    const seen = new Set<string>();
    const data: any[] = [];
    for (const r of rows as any[]) {
      const key = [
        r.packagingNo,
        r.materialCode,
        r.qty,
        r.weight,
        r.length,
        r.width,
        r.height,
      ].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      data.push({
        packagingNo: r.packagingNo,
        customerDestination: r.customerDestination,
        materialCode: r.materialCode,
        materialName: r.materialName,
        materialBrand: r.materialBrand,
        qty: r.qty,
        uom: r.uom,
        weight: r.weight,
        length: r.length,
        width: r.width,
        height: r.height,
      });
    }
    return {
      page: {
        page: Number(page),
        limit: size,
        totalData: total,
        totalPage: Math.ceil(total / size),
      },
      data,
      httpCode: HTTP_STATUS.OK,
    };
  }

  /** Q7 GET /shipments/:shipmentNo/pos — distinct PO per shipment
   *  (parity legacy GetPONumberByShipment, utk print surat pengiriman). */
  async getPosByShipmentNo(req: any) {
    const rows = await this.packagingRepository.findPosByShipmentNo(
      String(req.params.shipmentNo),
    );
    return { data: rows, httpCode: HTTP_STATUS.OK };
  }

  /** Q8 GET /:id/history — history status + leadtime (parity SP + formula
   *  sama dgn outstanding-incoming): leadtime dihitung ulang saat read —
   *  diff dua Date yang di-parse dgn TZ server yg sama selalu akurat (relatif),
   *  menyembuhkan baris lama yg salah akibat beda frame wall-clock WIB saat tulis. */
  async getHistory(id: string) {
    const header = await this.repository.getById(id);
    if (!header) {
      throw new NotFoundException('Plan outgoing not found');
    }
    const rows = await this.repository.findHistory(id);
    let prev: Date | null = null;
    return {
      data: rows.map((r) => {
        const h = r.get({ plain: true });
        const leadtime = prev
          ? Math.floor(
              ((h.date?.getTime() ?? 0) - prev.getTime()) / 60000,
            ) + 1
          : (h.leadtime ?? 0);
        prev = h.date ?? prev;
        return {
          id: h.id,
          planOutgoingHeaderId: h.planOutgoingHeaderId,
          status: h.status,
          date: h.date,
          pic: h.pic,
          leadtime,
          createdAt: h.createdDate,
          createdBy: h.createdBy,
        };
      }),
      httpCode: HTTP_STATUS.OK,
    };
  }
}
