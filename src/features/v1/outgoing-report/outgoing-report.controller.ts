import { Request } from 'express';
import { inject } from 'inversify';
import {
  BaseHttpController,
  controller,
  httpGet,
  request,
} from 'inversify-express-utils';
import {
  ControllerLogging,
  MICROSERVICE_IDENTIFIERS,
  QueryValidation,
  ValidatePermissions,
} from '@/shared-libs';
import { QueryService } from './query.service';
import { outgoingReportConstant as cst } from './constants';
import { OutgoingReportListDto } from './dtos';

const READ = { menuCode: cst.menuCode, action: 'READ' };

/**
 * @swagger
 * tags:
 *   - name: OutgoingReport
 *     description: Outgoing Report — laporan barang masuk hasil GR (parity CoreApp Report/OutgoingReport)
 */
@controller('/v1/outgoing-report')
export class OutgoingReportController extends BaseHttpController {
  private static readonly orLogging = ControllerLogging.forEntity(
    'outgoing-report',
    MICROSERVICE_IDENTIFIERS.SERVICE_OUTGOING,
  );

  constructor(
    @inject(QueryService) private readonly queryService: QueryService,
  ) {
    super();
  }

  /**
   * @swagger
   * /v1/outgoing-report:
   *   get:
   *     summary: List outgoing report — detail GR per rentang poDate (tenant dari session aktif)
   *     tags: [OutgoingReport]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     parameters:
   *       - { in: query, name: page, schema: { type: integer, minimum: 1 } }
   *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100 } }
   *       - { in: query, name: search, schema: { type: string } }
   *       - { in: query, name: searchBy, schema: { type: string, enum: [materialCode, materialName, materialBrand, deliveryNoteNo] } }
   *       - { in: query, name: startDate, required: true, schema: { type: string, format: date } }
   *       - { in: query, name: endDate, required: true, schema: { type: string, format: date } }
   *       - { in: query, name: order, schema: { type: string, enum: [materialCode, materialName, materialBrand, actualQty, uom, deliveryNoteNo, poDate] } }
   *       - { in: query, name: sort, schema: { type: string, enum: [asc, desc] } }
   *     responses:
   *       200: { description: List outgoing report }
   *       401: { description: Unauthorized }
   *       422: { description: Validation errors }
   */
  @ValidatePermissions(READ)
  @httpGet('/', QueryValidation(OutgoingReportListDto), OutgoingReportController.orLogging.list)
  async getAll(@request() req: Request) {
    return await this.queryService.getAll(req);
  }
}
