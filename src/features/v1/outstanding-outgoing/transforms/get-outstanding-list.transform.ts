import { DateHelper } from '@/shared-libs/helpers/date.helper';

/** Map row Q1 worklist — parity SP + pola GetAllTransform incoming.
 *  indicator: YES = tidak ada detail POQty≠PickingQty (hijau), NO = merah. */
export class GetOutstandingListTransform {
  transform(row: any): any {
    return {
      id: row.id,
      deliveryNoteNo: row.deliveryNoteNo,
      outgoingDate: row.outgoingDate
        ? DateHelper.formatDefault(row.outgoingDate)
        : null,
      poNo: row.poNo,
      poType: row.poType ?? null,
      poDate: row.poDate ? DateHelper.formatDefault(row.poDate) : null,
      customerDestination: row.customerDestination ?? null,
      referenceNo: row.referenceNo ?? null,
      description:
        row.description && row.description !== '' ? row.description : '-',
      status: row.status,
      isActive: row.isActive,
      isHold: row.isHold ? 1 : 0,
      createdAt: row.createdDate
        ? DateHelper.formatDefault(row.createdDate)
        : null,
      createdBy: row.createdBy ?? null,
      indicator: Number(row.mismatch ?? 0) === 0 ? 'YES' : 'NO',
    };
  }

  array(rows: any[]): any[] {
    return rows.map((row) => this.transform(row));
  }
}
