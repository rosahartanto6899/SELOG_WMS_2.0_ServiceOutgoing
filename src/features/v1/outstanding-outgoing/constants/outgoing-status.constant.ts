import moment from 'moment';

/**
 * Enum status outgoing — nilai teramati di DB dev (PlanOutgoingHeader.Status);
 * status lanjutan (Outgoing Finished dsb.) menyusul fitur actual outgoing.
 */
export const OUTGOING_STATUS = {
  DRAFT: 'Draft',
  CONFIRMED: 'Confirmed',
  PICKING: 'Picking',
  QUALITY_CONTROL: 'Quality Control',
  PACKAGING: 'Packaging',
  READY_TO_SHIP: 'Ready To Ship',
  TRANSIT_IN: 'Transit In',
  TRANSIT_OUT: 'Transit Out',
  CANCELLATION: 'Cancellation',
  CANCELLED: 'Cancelled',
  HOLD: 'Hold',
} as const;

export type OutgoingStatus = (typeof OUTGOING_STATUS)[keyof typeof OUTGOING_STATUS];

export const outstandingOutgoingConstant = {
  // ponytail: menu OUTSTANDING-OUTGOING belum terdaftar di wms-user-dev → 403 di
  // semua endpoint; pakai menu Input Plan Outgoing yang sudah ada + UAM SUPERADMIN.
  // Pindah ke menu sendiri setelah registrasi Menu+Uam di DB user.
  menuCode: 'INPUT-PLAN-OUTGOING',
  defaultDescription: '-',
  systemUser: 'System',
  messages: {
    success: 'Success',
    updateSkipped: 'Update skipped',
    alreadyExists: 'alreadyexists',
    notFound: 'Plan outgoing not found',
  },
} as const;

// ============ spec 004 — worklist list (parity SP, verified 2026-09-08) ============

/** Q1 definisi outstanding (usp_GetAllDataOutstandingOutgoing) */
export const OUTSTANDING_EXCLUDE_STATUS = [
  OUTGOING_STATUS.READY_TO_SHIP,
  OUTGOING_STATUS.TRANSIT_OUT,
] as const;

/** Pengecualian khusus Q1: NOT (POType='Adjustment' AND Status='Quality Control') */
export const ADJUSTMENT_QC_EXCLUDE = {
  poType: 'Adjustment',
  status: OUTGOING_STATUS.QUALITY_CONTROL,
} as const;

/** Q10/Q11 totals (usp_GetAllOutstandingByWarehouseCode versi outgoing) */
export const TOTALS_STATUS = [
  OUTGOING_STATUS.PICKING,
  OUTGOING_STATUS.DRAFT,
  OUTGOING_STATUS.CONFIRMED,
  OUTGOING_STATUS.PACKAGING,
] as const;

/** Q2/Q3 filter status tab DN Items & Packaging (verified SP) */
export const ITEMS_PACKAGING_STATUS = [
  OUTGOING_STATUS.QUALITY_CONTROL,
  OUTGOING_STATUS.PACKAGING,
] as const;

/** Filter status plan-qty per material (usp_GetPlanOutgoingQtyByMaterialCode):
 *  NOT IN whitelist — status baru otomatis masuk hitungan */
export const PLAN_QTY_EXCLUDE_STATUS = [
  OUTGOING_STATUS.DRAFT,
  OUTGOING_STATUS.READY_TO_SHIP,
  OUTGOING_STATUS.TRANSIT_OUT,
] as const;

/** Q4: header Ready To Ship tetap muncul di list shipment selama N hari
 *  sejak status diset (H.modifiedDate) — lalu di-exclude (deviasi dari
 *  usp_GetAllDataShipment; H.modifiedDate dipakai sebagai anchor, bukan
 *  row history, jadi edit lain saat RTS bisa memperpanjang window). */
export const SHIPMENT_RTS_RETENTION_DAYS = 3;

/** Q1 search LIKE gabung 6 kolom (parity SP) */
export const LIST_SEARCH_COLUMNS = [
  'poNo',
  'deliveryNoteNo',
  'customerDestination',
  'referenceNo',
  'description',
  'status',
] as const;

/** Q1 advanced searchBy — parity pola LOGIS incoming: whitelist = kolom
 *  search gabung (6 header LIKE) + materialCode (exact di detail, SP @MaterialCode) */
export const LIST_SEARCHBY_COLUMNS = [
  ...LIST_SEARCH_COLUMNS,
  'materialCode',
] as const;

/** Q1 whitelist sort (map FE camelCase → kolom entity) */
export const LIST_ORDER_WHITELIST: Record<string, string> = {
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

/** Add-info EAV: baris name='skip' diabaikan (parity SP insert add-info incoming) */
export function filterAddInfos(
  rows: Array<{ name?: string; value?: string }>,
): Array<{ name: string; value: string }> {
  return rows
    .filter((r) => r.name && r.name !== 'skip')
    .map((r) => ({ name: r.name!, value: r.value ?? '' }));
}

/**
 * Leadtime history dalam MENIT (+1) parity SP — formula sama dgn
 * outstanding-incoming (DATEDIFF(MINUTE, LastDate, now) + 1; 0 untuk baris pertama).
 *
 * Kolom DATETIME menyimpan wall-clock WIB (timezone '+07:00' saat tulis),
 * tapi parse-balik driver memakai TZ server — epoch hasil baca TIDAK bisa
 * dibandingkan langsung dgn `now` (beda 7 jam → leadtime minus).
 * Solusi: bandingkan kedua tanggal sebagai string wall-clock naive.
 */
export function leadtimeMinutes(lastDate: Date | null, now: Date): number {
  if (!lastDate) return 0;
  const lastWall = moment(lastDate).format('YYYY-MM-DD HH:mm:ss');
  const nowWall = moment(now).utcOffset(420).format('YYYY-MM-DD HH:mm:ss');
  return moment(nowWall).diff(moment(lastWall), 'minutes') + 1;
}
