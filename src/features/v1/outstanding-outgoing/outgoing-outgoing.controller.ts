import { Request } from 'express';
import { inject } from 'inversify';
import {
  BaseHttpController,
  controller,
  httpGet,
  httpPost,
  httpPut,
  request,
} from 'inversify-express-utils';
import {
  BodyValidation,
  ParamValidation,
  QueryValidation,
  ValidatePermissions,
} from '@/shared-libs';
import {
  LoggingActions,
  withLogging,
} from '@/shared-libs/helpers/logging.helper';
import { QueryService } from './query.service';
import { CommandService } from './command.service';
import { outstandingOutgoingConstant as cst } from './constants';
import {
  HeaderParamDto,
  DetailIdParamDto,
  CreateOutgoingDto,
  AddDetailDto,
  UpdateOutgoingHeaderDto,
  UpdateOutgoingDetailDto,
  ListDto,
  ItemsQueryDto,
  PackagingQueryDto,
  PoByPackagingQueryDto,
  PackagingByShipmentQueryDto,
  ShipmentQueryDto,
  TotalsDto,
  IndicatorDto,
  IdsActionDto,
  UpdateStatusDto,
  PlanQtyDto,
  PickingDto,
  CreatePackagingDto,
  ReadyToShipDto,
  PackagingNoParamDto,
  ShipmentNoParamDto,
  BulkStatusDto,
  SequentialConfigDto,
  MaterialCodeParamDto,
} from './dtos';

const READ = { menuCode: cst.menuCode, action: 'READ' };
const CREATE = { menuCode: cst.menuCode, action: 'CREATE' };
const UPDATE = { menuCode: cst.menuCode, action: 'UPDATE' };
const DELETE = { menuCode: cst.menuCode, action: 'DELETE' };

/**
 * @swagger
 * tags:
 *   - name: OutstandingOutgoing
 *     description: Input plan outgoing (C1–C4, C6) + worklist outstanding
 *       outgoing Q1–Q4/Q10–Q12 (spec 004) — parity SP verified
 */
@controller('/v1/outstanding-outgoing')
export class OutstandingOutgoingController extends BaseHttpController {
  constructor(
    @inject(QueryService) private readonly queryService: QueryService,
    @inject(CommandService) private readonly commandService: CommandService,
  ) {
    super();
  }

  // ================= Worklist queries (spec 004) =================

  /**
   * @swagger
   * /v1/outstanding-outgoing:
   *   get:
   *     summary: Q1 — List DN outstanding (server-side; filter verified SP)
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     parameters:
   *       - { in: query, name: page, schema: { type: integer, minimum: 1 } }
   *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100 } }
   *       - { in: query, name: search, schema: { type: string } }
   *       - { in: query, name: searchBy, schema: { type: string, enum: [deliveryNoteNo, poNo, materialCode] } }
   *       - { in: query, name: customerCode, schema: { type: string } }
   *       - { in: query, name: warehouseCode, schema: { type: string } }
   *       - { in: query, name: deliveryNoteNoFilter, schema: { type: string } }
   *       - { in: query, name: order, schema: { type: string } }
   *       - { in: query, name: sort, schema: { type: string, enum: [asc, desc] } }
   *     responses:
   *       200: { description: List + indikator per baris }
   *       422: { description: Validation errors }
   */
  @ValidatePermissions(READ)
  @httpGet('/', QueryValidation(ListDto), withLogging(LoggingActions.VIEW('outgoing-outgoing')))
  async getAll(@request() req: Request) {
    return await this.queryService.getAll(req);
  }

  /**
   * @swagger
   * /v1/outstanding-outgoing/plan-qty/{materialCode}:
   *   get:
   *     summary: Q-planQty — Sisa qty satu material per DN (parity usp_GetPlanOutgoingQtyByMaterialCode)
   *     description: Tenant (customer/warehouse) diambil dari session aktif, bukan query param
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     parameters:
   *       - { in: path, name: materialCode, required: true, schema: { type: string } }
   *     responses:
   *       200: { description: Sisa qty per DN }
   */
  @ValidatePermissions(READ)
  @httpGet(
    '/plan-qty/:materialCode',
    ParamValidation(MaterialCodeParamDto),
    withLogging(LoggingActions.VIEW('outgoing-outgoing')),
  )
  async getPlanQtyByMaterial(@request() req: Request) {
    return await this.queryService.getPlanQtyByMaterial(req);
  }

  /**
   * @swagger
   * /v1/outstanding-outgoing/items:
   *   get:
   *     summary: Q2 — DN items belum ber-packaging (tab DN Items)
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     parameters:
   *       - { in: query, name: customerCode, required: true, schema: { type: string } }
   *       - { in: query, name: warehouseCode, required: true, schema: { type: string } }
   *     responses:
   *       200: { description: Items list }
   */
  @ValidatePermissions(READ)
  @httpGet('/items', QueryValidation(ItemsQueryDto), withLogging(LoggingActions.VIEW('outgoing-outgoing')))
  async getItems(@request() req: Request) {
    return await this.queryService.getItems(req);
  }

  /**
   * @swagger
   * /v1/outstanding-outgoing/packagings:
   *   get:
   *     summary: Q3 — Packaging aktif belum ber-shipment (tab Packaging)
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     parameters:
   *       - { in: query, name: customerCode, required: true, schema: { type: string } }
   *       - { in: query, name: warehouseCode, required: true, schema: { type: string } }
   *     responses:
   *       200: { description: Packaging list }
   */
  @ValidatePermissions(READ)
  @httpGet('/packagings', QueryValidation(PackagingQueryDto), withLogging(LoggingActions.VIEW('outgoing-outgoing')))
  async getPackagings(@request() req: Request) {
    return await this.queryService.getPackagings(req);
  }

  /**
   * @swagger
   * /v1/outstanding-outgoing/shipments:
   *   get:
   *     summary: Q4 — Shipment outstanding (tab Shipment)
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     parameters:
   *       - { in: query, name: customerCode, required: true, schema: { type: string } }
   *       - { in: query, name: warehouseCode, required: true, schema: { type: string } }
   *     responses:
   *       200: { description: Shipment list }
   */
  @ValidatePermissions(READ)
  @httpGet('/shipments', QueryValidation(ShipmentQueryDto), withLogging(LoggingActions.VIEW('outgoing-outgoing')))
  async getShipments(@request() req: Request) {
    return await this.queryService.getShipments(req);
  }

  /**
   * @swagger
   * /v1/outstanding-outgoing/totals:
   *   post:
   *     summary: Q10 — Grand total outstanding (badge)
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/OutstandingOutgoingTotalsDto' }
   *     responses:
   *       200: { description: Total }
   */
  @ValidatePermissions(READ)
  @httpPost('/totals', BodyValidation(TotalsDto), withLogging(LoggingActions.VIEW('outgoing-outgoing')))
  async getTotals(@request() req: Request) {
    return await this.queryService.getTotals(req);
  }

  /**
   * @swagger
   * /v1/outstanding-outgoing/totals/by-warehouse:
   *   post:
   *     summary: Q11 — Total outstanding per warehouse (modal rincian)
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/OutstandingOutgoingTotalsDto' }
   *     responses:
   *       200: { description: Total per warehouse }
   */
  @ValidatePermissions(READ)
  @httpPost('/totals/by-warehouse', BodyValidation(TotalsDto), withLogging(LoggingActions.VIEW('outgoing-outgoing')))
  async getTotalsByWarehouse(@request() req: Request) {
    return await this.queryService.getTotalsByWarehouse(req);
  }

  /**
   * @swagger
   * /v1/outstanding-outgoing/indicator:
   *   post:
   *     summary: Q12 — Detail mismatch POQty vs PickingQty (parity usp_CheckIndicatorOutgoing)
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/OutstandingOutgoingIndicatorDto' }
   *     responses:
   *       200: { description: Mismatch rows }
   */
  @ValidatePermissions(READ)
  @httpPost('/indicator', BodyValidation(IndicatorDto), withLogging(LoggingActions.VIEW('outgoing-outgoing')))
  async checkIndicator(@request() req: Request) {
    return await this.queryService.checkIndicator(req);
  }


  /**
   * @swagger
   * /v1/outstanding-outgoing/packagings:
   *   post:
   *     summary: A8 — Create packaging (1 PackagingNo per submit; set detail.packagingNo; headers → Packaging; tanpa history)
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/OutstandingOutgoingCreatePackagingDto' }
   *     responses:
   *       200: { description: "Created (packagingNo)" }
   *       400: { description: alreadyPackaged / destinationMismatch }
   *       404: { description: Not found }
   */
  @ValidatePermissions(CREATE)
  @httpPost('/packagings', BodyValidation(CreatePackagingDto), withLogging(LoggingActions.CREATE('outgoing-outgoing')))
  async createPackagings(@request() req: Request) {
    return await this.commandService.createPackagings(req);
  }

  /**
   * @swagger
   * /v1/outstanding-outgoing/ready-to-ship:
   *   post:
   *     summary: A9 — Create shipment (1 ShipmentNo per grup; header → Ready To Ship bila semua detail ter-shipment; +history)
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/OutstandingOutgoingReadyToShipDto' }
   *     responses:
   *       200: { description: "Created (shipmentNo)" }
   *       404: { description: Not found }
   */
  @ValidatePermissions(UPDATE)
  @httpPost('/ready-to-ship', BodyValidation(ReadyToShipDto), withLogging(LoggingActions.UPDATE('outgoing-outgoing')))
  async readyToShip(@request() req: Request) {
    return await this.commandService.readyToShip(req);
  }

  /**
   * @swagger
   * /v1/outstanding-outgoing/packagings/{packagingNo}/pos:
   *   get:
   *     summary: Q5 — PO/detil pembentuk packaging
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     parameters:
   *       - { in: path, name: packagingNo, required: true, schema: { type: string } }
   *     responses:
   *       200: { description: PO rows }
   */
  @ValidatePermissions(READ)
  @httpGet('/packagings/:packagingNo/pos', ParamValidation(PackagingNoParamDto), QueryValidation(PoByPackagingQueryDto), withLogging(LoggingActions.VIEW('outgoing-outgoing')))
  async getPosByPackagingNo(@request() req: Request) {
    return await this.queryService.getPosByPackagingNo(req);
  }

  /**
   * @swagger
   * /v1/outstanding-outgoing/shipments/{shipmentNo}/packagings:
   *   get:
   *     summary: Q6 — Packaging per shipment
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     parameters:
   *       - { in: path, name: shipmentNo, required: true, schema: { type: string } }
   *     responses:
   *       200: { description: Packaging rows }
   */
  @ValidatePermissions(READ)
  @httpGet('/shipments/:shipmentNo/packagings', ParamValidation(ShipmentNoParamDto), QueryValidation(PackagingByShipmentQueryDto), withLogging(LoggingActions.VIEW('outstanding-outgoing')))
  async getPackagingsByShipmentNo(@request() req: Request) {
    return await this.queryService.getPackagingsByShipmentNo(req);
  }

  /**
   * @swagger
   * /v1/outstanding-outgoing/shipments/{shipmentNo}/pos:
   *   get:
   *     summary: Q7 — Distinct PO per shipment (print surat pengiriman)
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     parameters:
   *       - { in: path, name: shipmentNo, required: true, schema: { type: string } }
   *     responses:
   *       200: { description: "[{ poNo, description }]" }
   */
  @ValidatePermissions(READ)
  @httpGet('/shipments/:shipmentNo/pos', ParamValidation(ShipmentNoParamDto), withLogging(LoggingActions.VIEW('outstanding-outgoing')))
  async getPosByShipmentNo(@request() req: Request) {
    return await this.queryService.getPosByShipmentNo(req);
  }


  /**
   * @swagger
   * /v1/outstanding-outgoing/statuses:
   *   post:
   *     summary: A5 — Bulk status sequential (Ready To Ship; valid = QC + fully picked, invalid skip + hitung)
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/OutstandingOutgoingBulkStatusDto' }
   *     responses:
   *       200: { description: "{ updated, skipped[] }" }
   */
  @ValidatePermissions(UPDATE)
  @httpPost('/statuses', BodyValidation(BulkStatusDto), withLogging(LoggingActions.UPDATE('outgoing-outgoing')))
  async bulkUpdateStatus(@request() req: Request) {
    return await this.commandService.bulkUpdateStatus(req);
  }

  /**
   * @swagger
   * /v1/outstanding-outgoing/sequential-config:
   *   get:
   *     summary: A10 — Flag sequential process per customer (env-driven, lihat catatan)
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     parameters:
   *       - { in: query, name: customerCode, required: true, schema: { type: string } }
   *     responses:
   *       200: { description: "{ isSequentialProcess }" }
   */
  @ValidatePermissions(READ)
  @httpGet('/sequential-config', QueryValidation(SequentialConfigDto), withLogging(LoggingActions.VIEW('outgoing-outgoing')))
  async getSequentialConfig(@request() req: Request) {
    return await this.queryService.getSequentialConfig(
      (req.query as any).customerCode,
    );
  }

  // ================= Aksi massal (spec 004) =================

  /**
   * @swagger
   * /v1/outstanding-outgoing/confirm-draft:
   *   post:
   *     summary: A1 — Bulk Draft → Confirmed (+history); tanpa Draft → 'Update skipped'
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/OutstandingOutgoingIdsActionDto' }
   *     responses:
   *       200: { description: Success / Update skipped }
   */
  @ValidatePermissions(UPDATE)
  @httpPost('/confirm-draft', BodyValidation(IdsActionDto), withLogging(LoggingActions.UPDATE('outgoing-outgoing')))
  async confirmDraft(@request() req: Request) {
    return await this.commandService.confirmDraft(req);
  }

  /**
   * @swagger
   * /v1/outstanding-outgoing/confirm-cancellation:
   *   post:
   *     summary: A2 — Bulk → Cancelled (isActive=0 + history; SQS WHSCLIN kembalikan SOH picked)
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/OutstandingOutgoingIdsActionDto' }
   *     responses:
   *       200: { description: Success / Update skipped }
   */
  @ValidatePermissions(UPDATE)
  @httpPost('/confirm-cancellation', BodyValidation(IdsActionDto), withLogging(LoggingActions.UPDATE('outgoing-outgoing')))
  async confirmCancellation(@request() req: Request) {
    return await this.commandService.confirmCancellation(req);
  }

  /**
   * @swagger
   * /v1/outstanding-outgoing/delete:
   *   post:
   *     summary: A3 — Bulk soft delete (Draft saja; non-Draft skip diam)
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/OutstandingOutgoingIdsActionDto' }
   *     responses:
   *       200: { description: Done }
   */
  @ValidatePermissions(DELETE)
  @httpPost('/delete', BodyValidation(IdsActionDto), withLogging(LoggingActions.DELETE('outgoing-outgoing')))
  async deleteOutstanding(@request() req: Request) {
    return await this.commandService.deleteOutstanding(req);
  }

  /**
   * @swagger
   * /v1/outstanding-outgoing/{id}/status:
   *   put:
   *     summary: A4 — Ubah status single (Picking/QC/Transit; guard Cancelled & Ready To Ship → skipped)
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/OutstandingOutgoingStatusDto' }
   *     responses:
   *       200: { description: Success / Update skipped }
   *       400: { description: transit requires POType MUTATION }
   *       404: { description: Not found }
   */
  @ValidatePermissions(UPDATE)
  @httpPut('/:id/status', ParamValidation(HeaderParamDto), BodyValidation(UpdateStatusDto), withLogging(LoggingActions.UPDATE('outgoing-outgoing')))
  async updateStatus(@request() req: Request) {
    return await this.commandService.updateStatus(
      req.params.id,
      req.body as UpdateStatusDto,
      req,
    );
  }

  /**
   * @swagger
   * /v1/outstanding-outgoing/{id}/details:
   *   get:
   *     summary: Q7 — Detail DN (view page + picking modal; header + details + addInfo + canEdit)
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
   *     responses:
   *       200: { description: Detail }
   *       404: { description: Not found }
   */
  @ValidatePermissions(READ)
  @httpGet('/:id/details', ParamValidation(HeaderParamDto), withLogging(LoggingActions.VIEW('outgoing-outgoing')))
  async getDetails(@request() req: Request) {
    return await this.queryService.getDetails(req.params.id);
  }

  /**
   * @swagger
   * /v1/outstanding-outgoing/{id}/history:
   *   get:
   *     summary: Q8 — History status + leadtime (menit)
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
   *     responses:
   *       200: { description: History }
   *       404: { description: Not found }
   */
  @ValidatePermissions(READ)
  @httpGet('/:id/history', ParamValidation(HeaderParamDto), withLogging(LoggingActions.VIEW('outgoing-outgoing')))
  async getHistory(@request() req: Request) {
    return await this.queryService.getHistory(req.params.id);
  }

  /**
   * @swagger
   * /v1/outstanding-outgoing/details/{detailId}/plan-qty:
   *   put:
   *     summary: A6 — Adjust qty detail (Draft→POQty; picked non-Draft→PickingQty; desc append; SQS WHSREVOUT)
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     parameters:
   *       - { in: path, name: detailId, required: true, schema: { type: string, format: uuid } }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/OutstandingOutgoingPlanQtyDto' }
   *     responses:
   *       200: { description: Success }
   *       404: { description: Not found }
   */
  @ValidatePermissions(UPDATE)
  @httpPut('/details/:detailId/plan-qty', ParamValidation(DetailIdParamDto), BodyValidation(PlanQtyDto), withLogging(LoggingActions.UPDATE('outgoing-outgoing')))
  async updatePlanQty(@request() req: Request) {
    return await this.commandService.updatePlanQty(
      req.params.detailId,
      req.body as PlanQtyDto,
      req,
    );
  }

  /**
   * @swagger
   * /v1/outstanding-outgoing/picking:
   *   post:
   *     summary: A7 — Realisasi picking satu detail (SET pickingQty=actualQty, 0→POQty; +barcode validasi; SQS WHSOUT)
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/OutstandingOutgoingPickingDto' }
   *     responses:
   *       200: { description: Header snapshot + qty }
   *       400: { description: barcode mismatch / Draft / Cancelled }
   *       404: { description: Not found }
   */
  @ValidatePermissions(UPDATE)
  @httpPost('/picking', BodyValidation(PickingDto), withLogging(LoggingActions.UPDATE('outgoing-outgoing')))
  async submitPicking(@request() req: Request) {
    return await this.commandService.submitPicking(
      (req.body as PickingDto).detailId,
      req.body as PickingDto,
      req,
    );
  }

  /**
   * @swagger
   * /v1/outstanding-outgoing/{id}/picking-slip:
   *   get:
   *     summary: Q15 — Data cetak picking slip (kolom parity usp_GetPrintDataPickingSlip)
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
   *     responses:
   *       200: { description: Slip rows }
   *       404: { description: Not found }
   */
  @ValidatePermissions(READ)
  @httpGet('/:id/picking-slip', ParamValidation(HeaderParamDto), withLogging(LoggingActions.VIEW('outgoing-outgoing')))
  async getPickingSlip(@request() req: Request) {
    return await this.queryService.getPickingSlip(req.params.id);
  }

  // ================= Input manual (spec 003) =================

  /**
   * @swagger
   * /v1/outstanding-outgoing:
   *   post:
   *     summary: C1 — Input DN outgoing manual (header + semua detail + add-info, SATU submit atomic)
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/OutstandingOutgoingCreateDto' }
   *     responses:
   *       201: { description: Created (id) }
   *       400: { description: alreadyexists / duplicate materialCode }
   *       422: { description: Validation errors }
   */
  @ValidatePermissions(CREATE)
  @httpPost('/', BodyValidation(CreateOutgoingDto), withLogging(LoggingActions.CREATE('outgoing-outgoing')))
  async createOutgoing(@request() req: Request) {
    return await this.commandService.createOutgoing(req);
  }

  /**
   * @swagger
   * /v1/outstanding-outgoing/{id}/details:
   *   post:
   *     summary: C2 — Tambah material ke DN outgoing existing
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/OutstandingOutgoingAddDetailDto' }
   *     responses:
   *       201: { description: Created }
   *       400: { description: alreadyexists }
   *       404: { description: Not found }
   */
  @ValidatePermissions(CREATE)
  @httpPost('/:id/details', ParamValidation(HeaderParamDto), BodyValidation(AddDetailDto), withLogging(LoggingActions.CREATE('outgoing-outgoing')))
  async addDetails(@request() req: Request) {
    return await this.commandService.addDetails(req);
  }

  /**
   * @swagger
   * /v1/outstanding-outgoing/{id}:
   *   put:
   *     summary: C3 — Edit header outgoing (guard DN header lain, add-info replace)
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/OutstandingOutgoingUpdateHeaderDto' }
   *     responses:
   *       200: { description: Updated }
   *       400: { description: alreadyexists }
   *       404: { description: Not found }
   */
  @ValidatePermissions(UPDATE)
  @httpPut('/:id', ParamValidation(HeaderParamDto), BodyValidation(UpdateOutgoingHeaderDto), withLogging(LoggingActions.UPDATE('outgoing-outgoing')))
  async updateOutgoingHeader(@request() req: Request) {
    return await this.commandService.updateOutgoingHeader(req);
  }

  /**
   * @swagger
   * /v1/outstanding-outgoing/details/{id}:
   *   put:
   *     summary: C4 — Edit detail outgoing (hanya poQty + add-info replace)
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/OutstandingOutgoingUpdateDetailDto' }
   *     responses:
   *       200: { description: Updated }
   *       404: { description: Not found }
   */
  @ValidatePermissions(UPDATE)
  @httpPut('/details/:id', ParamValidation(DetailIdParamDto), BodyValidation(UpdateOutgoingDetailDto), withLogging(LoggingActions.UPDATE('outgoing-outgoing')))
  async updateOutgoingDetail(@request() req: Request) {
    return await this.commandService.updateOutgoingDetail(req);
  }

  /**
   * @swagger
   * /v1/outstanding-outgoing/{id}/edit:
   *   get:
   *     summary: C6 — Data form edit (header + details + add-info + flag bisa-edit)
   *     tags: [OutstandingOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
   *     responses:
   *       200: { description: Edit data }
   *       404: { description: Not found }
   */
  @ValidatePermissions(READ)
  @httpGet('/:id/edit', ParamValidation(HeaderParamDto), withLogging(LoggingActions.VIEW('outgoing-outgoing')))
  async getEdit(@request() req: Request) {
    return await this.queryService.getEdit(req.params.id);
  }
}
