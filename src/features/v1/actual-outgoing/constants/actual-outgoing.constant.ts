/**
 * Konstanta modul Actual Outgoing — list header siap/menunggu aktualisasi
 * keluar (parity CoreApp ActualOutgoing + SP usp_GetAllActualOutgoing,
 * verified read-only 2026-09-10, spec 005).
 */

/** Filter utama SP: status IN (...) ATAU pasangan Adjustment+QC */
export const ACTUAL_INCLUDE_STATUS = [
  'Ready To Ship',
  'Stock Adjustment',
  'Transit Out',
] as const;

/** Kasus khusus SP: (POType='Adjustment' AND Status='Quality Control') */
export const ACTUAL_ADJUSTMENT_QC = {
  poType: 'Adjustment',
  status: 'Quality Control',
} as const;

/** Q1 search LIKE gabung 6 kolom (parity SP search legacy) */
export const ACTUAL_LIST_SEARCH_COLUMNS = [
  'poNo',
  'deliveryNoteNo',
  'customerDestination',
  'referenceNo',
  'description',
  'status',
] as const;

/** Q1 advanced searchBy whitelist (header LIKE + parity worklist outgoing) */
export const ACTUAL_LIST_SEARCHBY_COLUMNS = [
  ...ACTUAL_LIST_SEARCH_COLUMNS,
] as const;

/** Q2 detail-search whitelist — kolom penting material (shipmentNo via packaging) */
export const ACTUAL_DETAIL_SEARCH_WHITELIST = [
  'materialCode',
  'materialName',
  'materialBrand',
  'shipmentNo',
  'packagingNo',
] as const;

/** Q1 whitelist sort (map FE camelCase → kolom entity) */
export const ACTUAL_LIST_ORDER_WHITELIST: Record<string, string> = {
  id: 'id',
  deliveryNoteNo: 'deliveryNoteNo',
  outgoingDate: 'outgoingDate',
  poNo: 'poNo',
  poType: 'poType',
  poDate: 'poDate',
  customerDestination: 'customerDestination',
  referenceNo: 'referenceNo',
  description: 'description',
  status: 'status',
  createdAt: 'createdDate',
  createdBy: 'createdBy',
};

export const actualOutgoingConstant = {
  // ponytail: menu ACTUAL-OUTGOING belum terdaftar di wms-user-dev → 403;
  // pakai menu Input Plan Outgoing (parity outstanding-outgoing), pindah
  // setelah registrasi Menu+Uam.
  menuCode: 'INPUT-PLAN-OUTGOING',
  defaultSort: 'deliveryNoteNo', // parity ORDER BY SP
} as const;
