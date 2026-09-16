import { injectable } from 'inversify';
import { Includeable, Order, WhereOptions } from 'sequelize';
import { PlanOutgoingDetail, PlanOutgoingHeader } from '@/database/entities';

/** Row report outgoing — parity OutgoingReport legacy CoreApp */
export interface OutgoingReportRow {
  id: string;
  materialCode: string;
  materialName: string;
  materialBrand: string;
  uom: string;
  // ponytail: qty aktual keluar tersimpan di PickingQty (verified DB live 2026-09-15);
  
  pickingQty: number | null;
  header: {
    deliveryNoteNo: string;
    poDate: Date | null;
  };
}

/** Query Outgoing Report — parity usp_GetAllDataReportOutgoing (dump SP tidak
 *  tersedia; rekonstruksi dari kolom DTO + ACTUAL_INCLUDE_STATUS actual-outgoing). */
@injectable()
export class OutgoingReportRepository {
  private receivedInclude(headerWhere: WhereOptions): Includeable {
    return {
      model: PlanOutgoingHeader,
      as: 'header',
      required: true,
      attributes: ['deliveryNoteNo', 'poDate'],
      where: headerWhere,
    };
  }

  /** Rows report — detail JOIN header (INNER) ter-filter tanggal + status GR */
  public async findAll(
    headerWhere: WhereOptions,
    detailWhere: WhereOptions,
    order: Order,
    limit: number,
    offset: number,
  ): Promise<OutgoingReportRow[]> {
    const rows = await PlanOutgoingDetail.findAll({
      where: detailWhere,
      include: [this.receivedInclude(headerWhere)],
      order,
      limit,
      offset,
      raw: true,
      nest: true,
    });
    return rows as unknown as OutgoingReportRow[];
  }

  /** COUNT untuk recordsTotal & recordsFiltered */
  public async countAll(
    headerWhere: WhereOptions,
    detailWhere: WhereOptions,
  ): Promise<number> {
    return await PlanOutgoingDetail.count({
      where: detailWhere,
      include: [this.receivedInclude(headerWhere)],
    });
  }
}
