/**
 * Enum status outgoing — nilai teramati di DB dev (PlanOutgoingHeader.Status);
 * status lanjutan (Outgoing Finished dsb.) menyusul fitur actual outgoing.
 */
export const OUTGOING_STATUS = {
  DRAFT: 'Draft',
  CONFIRMED: 'Confirmed',
  PICKING: 'Picking',
  PACKAGING: 'Packaging',
  READY_TO_SHIP: 'Ready To Ship',
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

/** Add-info EAV: baris name='skip' diabaikan (parity SP insert add-info incoming) */
export function filterAddInfos(
  rows: Array<{ name?: string; value?: string }>,
): Array<{ name: string; value: string }> {
  return rows
    .filter((r) => r.name && r.name !== 'skip')
    .map((r) => ({ name: r.name!, value: r.value ?? '' }));
}
