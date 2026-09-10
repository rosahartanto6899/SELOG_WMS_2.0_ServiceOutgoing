import { injectable } from 'inversify';
import { Op, QueryTypes, Transaction, WhereOptions } from 'sequelize';
import { sequelize } from '@/utils/database.util';
import {
  PlanOutgoingDetail,
  PlanOutgoingHeader,
  PlanOutgoingPackaging,
} from '@/database/entities';
import { nowWib } from '@/utils';
import { ITEMS_PACKAGING_STATUS } from '../constants';

/** Q2/Q3/Q4 — tab DN Items & Packaging & Shipment (spec 004, parity SP
 *  usp_GetAllDataOutstandingPackaging / usp_GetAllDataPackaging /
 *  usp_GetAllDataShipment — verified 2026-09-08). Tanpa paging (list penuh,
 *  parity DataTables client-side legacy). */
@injectable()
export class PlanOutgoingPackagingRepository {
  /** Q2 — DN items (server-side): detail SUDAH DIPICKING & belum
   *  ber-packaging, header QC/Packaging non-Adjustment ber-destination.
   *  search LIKE gabung (material* + header DN/PO/destination); sort whitelist. */
  public async findItems(param: {
    customerCode: string;
    warehouseCode: string;
    search?: string;
    searchBy?: string;
    order: string;
    sort: 'ASC' | 'DESC';
    limit: number;
    offset: number;
  }) {
    const headerWhere: WhereOptions = {
      customerCode: param.customerCode,
      warehouseCode: param.warehouseCode,
      isActive: true,
      status: { [Op.in]: [...ITEMS_PACKAGING_STATUS] },
      poType: { [Op.ne]: 'Adjustment' },
      customerDestination: { [Op.ne]: null },
    };

    const detailWhere: WhereOptions = {
      packagingNo: null,
      pickingDate: { [Op.ne]: null },
    };
    if (param.search) {
      const like = `%${param.search}%`;
      if (param.searchBy) {
        // satu kolom (whitelist DTO): header kolom via $header.x$
        const col = param.searchBy.startsWith('deliveryNoteNo')
          ? 'deliveryNoteNo'
          : param.searchBy.startsWith('poNo')
            ? 'poNo'
            : param.searchBy === 'customerDestination'
              ? 'customerDestination'
              : param.searchBy === 'createdAt'
                ? 'createdDate'
                : null;
        if (col) detailWhere[`$header.${col}$`] = { [Op.like]: like };
        else detailWhere[param.searchBy] = { [Op.like]: like };
      } else {
        (detailWhere as any)[Op.or] = [
          { materialCode: { [Op.like]: like } },
          { materialName: { [Op.like]: like } },
          { materialBrand: { [Op.like]: like } },
          { '$header.deliveryNoteNo$': { [Op.like]: like } },
          { '$header.poNo$': { [Op.like]: like } },
          { '$header.customerDestination$': { [Op.like]: like } },
        ];
      }
    }

    const HEADER_COLS = new Set(['deliveryNoteNo', 'poNo', 'customerDestination']);
    const order: any = HEADER_COLS.has(param.order)
      ? [{ model: PlanOutgoingHeader, as: 'header' }, param.order, param.sort]
      : param.order === 'createdAt'
        ? [{ model: PlanOutgoingHeader, as: 'header' }, 'createdDate', param.sort]
        : [param.order, param.sort];

    const include = [
      {
        model: PlanOutgoingHeader,
        as: 'header',
        attributes: [
          'deliveryNoteNo',
          'poNo',
          'customerDestination',
          'status',
          'createdDate',
        ],
        where: headerWhere,
        required: true,
      },
    ];

    const rows = await PlanOutgoingDetail.findAll({
      attributes: [
        'id',
        'materialBarcode',
        'materialCode',
        'materialName',
        'materialBrand',
        'poQty',
        'pickingQty',
        'uom',
        'packagingNo',
      ],
      where: detailWhere,
      include,
      order: [order],
      limit: param.limit,
      offset: param.offset,
      subQuery: false,
      raw: true,
    });

    const total = await PlanOutgoingDetail.count({
      where: detailWhere,
      include,
    });

    return { rows, total };
  }

  /** Q3 — packaging aktif belum ber-shipment; INNER JOIN detail+header
   *  memvalidasi linkage + filter status (parity SP). SUM(DISTINCT Qty)+GROUP
   *  di SP redundant (1 row packaging = 1 grup material hasil A8) — row
   *  langsung dipakai. */
  /** Q3 — 1 baris per packagingNo (qty SUM DISTINCT parity SP legacy;
   *  group by material bikin 1 packaging pecah jadi N baris → fix double).
   *  Raw SQL — Sequelize menyelipkan PK mentah ke SELECT saat hasMany+
   *  sourceKey, dan itu tidak valid di GROUP BY (SQL Server).
   *  Server-side: search (LIKE gabung), searchBy whitelist, sort, paging. */
  public async findPackagings(param: {
    customerCode: string;
    warehouseCode: string;
    search?: string;
    searchBy?: string;
    order: string;
    sort: 'ASC' | 'DESC';
    limit: number;
    offset: number;
  }) {
    // ORDER BY: kolom grup langsung, sisanya via agregat (valid SQL Server)
    const ORDER_COLS: Record<string, string> = {
      packagingNo: 'P.packagingNo',
      materialCode: 'MAX(P.materialCode)',
      materialName: 'MAX(P.materialName)',
      customerDestination: 'MAX(P.customerDestination)',
      qty: 'SUM(DISTINCT P.qty)',
      createdAt: 'MAX(P.createdDate)',
    };
    const orderBy = ORDER_COLS[param.order] ?? ORDER_COLS.createdAt;
    const like = param.search ? `%${param.search}%` : null;
    const searchByCol = param.searchBy ? ORDER_COLS[param.searchBy] : null;

    const where = `
        WHERE P.isActive = 1 AND P.shipmentNo IS NULL
          AND H.customerCode = :customerCode
          AND H.warehouseCode = :warehouseCode
          AND H.isActive = 1 AND H.status IN (:statuses)
          AND H.poType <> 'Adjustment' AND H.customerDestination IS NOT NULL
          ${like ? (searchByCol ? `AND ${searchByCol} LIKE :like` : `AND (P.packagingNo LIKE :like OR P.materialCode LIKE :like OR P.materialName LIKE :like OR P.customerDestination LIKE :like)`) : ''}`;
    const from = `
         FROM PlanOutgoingPackaging P
         INNER JOIN PlanOutgoingDetail D ON D.packagingNo = P.packagingNo
         INNER JOIN PlanOutgoingHeader H ON H.id = D.planOutgoingHeaderId`;
    const repl = {
      customerCode: param.customerCode,
      warehouseCode: param.warehouseCode,
      statuses: [...ITEMS_PACKAGING_STATUS],
      ...(like ? { like } : {}),
    };

    const rows = await sequelize.query(
      `SELECT MAX(P.id) AS id, P.packagingNo,
              MAX(P.customerDestination) AS customerDestination,
              MAX(P.materialCode) AS materialCode,
              MAX(P.materialName) AS materialName,
              SUM(DISTINCT P.qty) AS qty, MAX(P.uom) AS uom,
              SUM(P.weight) AS weight,
              MAX(P.length) AS length, MAX(P.width) AS width,
              MAX(P.height) AS height, MAX(P.createdDate) AS createdDate${from}${where}
        GROUP BY P.packagingNo
        ORDER BY ${orderBy} ${param.sort}
        OFFSET ${param.offset} ROWS FETCH NEXT ${param.limit} ROWS ONLY`,
      { replacements: repl, type: QueryTypes.SELECT },
    );
    const totalRows: any = await sequelize.query(
      `SELECT COUNT(DISTINCT P.packagingNo) AS total${from}${where}`,
      { replacements: repl, type: QueryTypes.SELECT },
    );
    return { rows, total: Number(totalRows[0]?.total ?? 0) };
  }

  /** Q4 — shipment: packaging ber-shipmentNo milik header aktif non-
   *  Ready-To-Ship (parity usp_GetAllDataShipment; GROUP BY ShipmentNo).
   *  Raw SQL — alasan sama dengan findPackagings (PK diselipkan Sequelize).
   *  Server-side: search LIKE, sort whitelist, paging. */
  public async findShipments(param: {
    customerCode: string;
    warehouseCode: string;
    search?: string;
    searchBy?: string;
    order: string;
    sort: 'ASC' | 'DESC';
    limit: number;
    offset: number;
  }) {
    const ORDER_COLS: Record<string, string> = {
      shipmentNo: 'P.shipmentNo',
      customerDestination: 'MAX(P.customerDestination)',
      modifiedDate: 'MAX(P.modifiedDate)',
    };
    const orderBy = ORDER_COLS[param.order] ?? ORDER_COLS.modifiedDate;
    const like = param.search ? `%${param.search}%` : null;
    const searchByCol = param.searchBy ? ORDER_COLS[param.searchBy] : null;

    const where = `
        WHERE P.isActive = 1 AND P.shipmentNo IS NOT NULL
          AND H.customerCode = :customerCode
          AND H.warehouseCode = :warehouseCode
          AND H.isActive = 1 AND H.status <> 'Ready To Ship'
          AND H.poType <> 'Adjustment' AND H.customerDestination IS NOT NULL
          ${like ? (searchByCol ? `AND ${searchByCol} LIKE :like` : `AND (P.shipmentNo LIKE :like OR P.customerDestination LIKE :like)`) : ''}`;
    const from = `
         FROM PlanOutgoingPackaging P
         INNER JOIN PlanOutgoingDetail D ON D.packagingNo = P.packagingNo
         INNER JOIN PlanOutgoingHeader H ON H.id = D.planOutgoingHeaderId`;
    const repl = {
      customerCode: param.customerCode,
      warehouseCode: param.warehouseCode,
      ...(like ? { like } : {}),
    };

    const rows = await sequelize.query(
      `SELECT P.shipmentNo,
              MAX(P.customerDestination) AS customerDestination,
              MAX(P.modifiedDate) AS modifiedDate${from}${where}
        GROUP BY P.shipmentNo
        ORDER BY ${orderBy} ${param.sort}
        OFFSET ${param.offset} ROWS FETCH NEXT ${param.limit} ROWS ONLY`,
      { replacements: repl, type: QueryTypes.SELECT },
    );
    const totalRows: any = await sequelize.query(
      `SELECT COUNT(DISTINCT P.shipmentNo) AS total${from}${where}`,
      { replacements: repl, type: QueryTypes.SELECT },
    );
    return { rows, total: Number(totalRows[0]?.total ?? 0) };
  }

  // ================= A8/A9/Q5/Q6 (spec 004 Fase 5) =================

  /** A8 — insert rows packaging (1 PackagingNo utk semua grup, parity SP) */
  public async createMany(
    rows: Array<Record<string, unknown>>,
    transaction?: Transaction,
  ) {
    return PlanOutgoingPackaging.bulkCreate(rows as any, { transaction });
  }

  /** A8 — packagingNo existing check (utk generate PKG unik) */
  public async findExistingPackagingNos(
    packagingNos: string[],
    transaction?: Transaction,
  ): Promise<string[]> {
    const rows = await PlanOutgoingPackaging.findAll({
      attributes: ['packagingNo'],
      where: { packagingNo: { [Op.in]: packagingNos } },
      transaction,
      raw: true,
    });
    return rows.map((r: any) => r.packagingNo);
  }

  /** A8 — set packagingNo pada detail terpilih */
  public async setDetailPackagingNo(
    detailIds: string[],
    packagingNo: string,
    userBy: string,
    transaction?: Transaction,
  ) {
    await PlanOutgoingDetail.update(
      {
        packagingNo,
        modifiedDate: nowWib(),
        modifiedBy: userBy,
      },
      { where: { id: { [Op.in]: detailIds } }, transaction },
    );
  }

  /** A9 — set shipmentNo pada packaging list */
  public async setShipmentNos(
    packagingNos: string[],
    shipmentNo: string,
    userBy: string,
    transaction?: Transaction,
  ) {
    await PlanOutgoingPackaging.update(
      {
        shipmentNo,
        modifiedDate: nowWib(),
        modifiedBy: userBy,
      },
      {
        where: {
          isActive: true,
          packagingNo: { [Op.in]: packagingNos },
        },
        transaction,
      },
    );
  }

  /** A9 — packaging by nos (utk cek destination + nomor) */
  public async findByPackagingNos(packagingNos: string[], transaction?: Transaction) {
    return PlanOutgoingPackaging.findAll({
      where: { isActive: true, packagingNo: { [Op.in]: packagingNos } },
      transaction,
    });
  }

  /** Q5 — PO/detil pembentuk packaging (usp_GetAllDataPOByPackagingNo);
   *  server-side: search LIKE (whitelist), sort, paging. */
  public async findPosByPackagingNo(
    packagingNo: string,
    param: {
      search?: string;
      searchBy?: string;
      order: string;
      sort: 'ASC' | 'DESC';
      limit: number;
      offset: number;
    },
  ) {
    const HEADER_COLS: Record<string, string> = {
      deliveryNoteNo: 'deliveryNoteNo',
      poNo: 'poNo',
      customerDestination: 'customerDestination',
    };
    const DETAIL_COLS: Record<string, string> = {
      materialCode: 'materialCode',
      materialName: 'materialName',
      materialBrand: 'materialBrand',
    };

    const where: WhereOptions = { packagingNo };
    if (param.search) {
      const like = { [Op.like]: `%${param.search}%` };
      if (param.searchBy) {
        const hCol = HEADER_COLS[param.searchBy];
        where[hCol ? `$header.${hCol}$` : DETAIL_COLS[param.searchBy]] = like;
      } else {
        (where as any)[Op.or] = [
          { materialCode: like },
          { materialName: like },
          { materialBrand: like },
          { '$header.deliveryNoteNo$': like },
          { '$header.poNo$': like },
          { '$header.customerDestination$': like },
        ];
      }
    }

    const orderCol = param.order
      ? HEADER_COLS[param.order]
        ? [{ model: PlanOutgoingHeader, as: 'header' }, HEADER_COLS[param.order], param.sort]
        : [DETAIL_COLS[param.order] ?? 'materialCode', param.sort]
      : ['materialCode', param.sort];

    const include = [
      {
        model: PlanOutgoingHeader,
        as: 'header',
        attributes: ['deliveryNoteNo', 'poNo', 'poType', 'poDate', 'customerDestination'],
        required: true,
      },
    ];

    const rows = await PlanOutgoingDetail.findAll({
      attributes: [
        'materialCode', 'materialName', 'materialBrand', 'uom',
        'poQty', 'pickingQty', 'pickingDate',
      ],
      where,
      include,
      order: [orderCol as any],
      limit: param.limit,
      offset: param.offset,
      subQuery: false,
      raw: true,
    });
    const total = await PlanOutgoingDetail.count({ where, include });
    return { rows, total };
  }

  /** Q6 — packaging per shipment (usp_GetAllDataPackagingByShipmentNo;
   *  DISTINCT → dedupe di service); server-side: search, sort, paging. */
  public async findByShipmentNo(
    shipmentNo: string,
    param: {
      search?: string;
      searchBy?: string;
      order: string;
      sort: 'ASC' | 'DESC';
      limit: number;
      offset: number;
    },
  ) {
    const COLS = [
      'packagingNo',
      'customerDestination',
      'materialCode',
      'materialName',
      'materialBrand',
    ];
    const where: WhereOptions = { shipmentNo };
    if (param.search) {
      const like = { [Op.like]: `%${param.search}%` };
      if (param.searchBy && COLS.includes(param.searchBy)) {
        (where as any)[param.searchBy] = like;
      } else {
        (where as any)[Op.or] = COLS.map((c) => ({ [c]: like }));
      }
    }
    const order: any = [
      COLS.includes(param.order) ? param.order : 'packagingNo',
      param.sort,
    ];

    const rows = await PlanOutgoingPackaging.findAll({
      where,
      order: [order],
      limit: param.limit,
      offset: param.offset,
      raw: true,
    });
    const total = await PlanOutgoingPackaging.count({ where });
    return { rows, total };
  }
}
