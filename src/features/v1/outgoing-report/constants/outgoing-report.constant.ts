/** Konstanta modul Outgoing Report — parity CoreApp Report/OutgoingReport */

/** Search LIKE gabung 4 kolom report (detail + deliveryNoteNo header) */
export const OUTGOING_REPORT_SEARCH_COLUMNS = [
  'materialCode',
  'materialName',
  'materialBrand',
  'deliveryNoteNo',
] as const;

/** Whitelist kolom sort — actualQty FE dipetakan ke kolom fisik pickingQty */
export const OUTGOING_REPORT_ORDER_WHITELIST: Record<string, string> = {
  materialCode: 'materialCode',
  materialName: 'materialName',
  materialBrand: 'materialBrand',
  actualQty: 'pickingQty',
  uom: 'uom',
  deliveryNoteNo: 'deliveryNoteNo',
  poDate: 'poDate',
};

export const outgoingReportConstant = {
  menuCode: 'OUTGOING-REPORT',
};
