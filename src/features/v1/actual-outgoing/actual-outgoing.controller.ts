import { Request } from 'express';
import { inject } from 'inversify';
import {
  BaseHttpController,
  controller,
  httpGet,
  request,
} from 'inversify-express-utils';
import { ParamValidation, QueryValidation, ValidatePermissions } from '@/shared-libs';
import { LoggingActions, withLogging } from '@/shared-libs/helpers/logging.helper';
import { QueryService } from './query.service';
import { actualOutgoingConstant as cst } from './constants';
import { ListDto, HeaderParamDto, DetailIdParamDto, DetailSearchDto } from './dtos';

const READ = { menuCode: cst.menuCode, action: 'READ' };

/**
 * @swagger
 * tags:
 *   - name: ActualOutgoing
 *     description: Actual outgoing read-only (spec 005) — parity SP
 *       usp_GetAllActualOutgoing verified 2026-09-10. Tanpa mutasi.
 */
@controller('/v1/actual-outgoing')
export class ActualOutgoingController extends BaseHttpController {
  constructor(
    @inject(QueryService) private readonly queryService: QueryService,
  ) {
    super();
  }

  /**
   * @swagger
   * /v1/actual-outgoing:
   *   get:
   *     summary: Q1 — List actual outgoing (server-side, SP parity)
   *     tags: [ActualOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     parameters:
   *       - { in: query, name: page, schema: { type: integer, minimum: 1 } }
   *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100 } }
   *       - { in: query, name: search, schema: { type: string } }
   *       - { in: query, name: searchBy, schema: { type: string } }
   *       - { in: query, name: customerCode, schema: { type: string } }
   *       - { in: query, name: warehouseCode, schema: { type: string } }
   *       - { in: query, name: order, schema: { type: string } }
   *       - { in: query, name: sort, schema: { type: string, enum: [asc, desc] } }
   *     responses:
   *       200: { description: List + paging }
   *       422: { description: Validation errors }
   */
  @ValidatePermissions(READ)
  @httpGet('/', QueryValidation(ListDto), withLogging(LoggingActions.VIEW('actual-outgoing')))
  async getAll(@request() req: Request) {
    return await this.queryService.getAll(req);
  }

  /**
   * @swagger
   * /v1/actual-outgoing/{id}/details:
   *   get:
   *     summary: Q2 — Header + details (+addInfo & shipmentNo, search material)
   *     tags: [ActualOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     parameters:
   *       - { in: query, name: search, schema: { type: string } }
   *       - { in: query, name: searchBy, schema: { type: string, enum: [materialCode, materialName, materialBrand, shipmentNo, packagingNo] } }
   *     responses:
   *       200: { description: Detail }
   *       404: { description: Not found }
   *       422: { description: Validation errors }
   */
  @ValidatePermissions(READ)
  @httpGet(
    '/:id/details',
    ParamValidation(HeaderParamDto),
    QueryValidation(DetailSearchDto),
  )
  async getDetails(@request() req: Request) {
    return await this.queryService.getDetails(String(req.params.id), req.query);
  }

  /**
   * @swagger
   * /v1/actual-outgoing/{id}/history:
   *   get:
   *     summary: Q3 — History status + leadtime (menit, recompute read)
   *     tags: [ActualOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     responses:
   *       200: { description: History rows }
   */
  @ValidatePermissions(READ)
  @httpGet('/:id/history', ParamValidation(HeaderParamDto))
  async getHistory(@request() req: Request) {
    return await this.queryService.getHistory(String(req.params.id));
  }

  /**
   * @swagger
   * /v1/actual-outgoing/{id}/add-info:
   *   get:
   *     summary: Q4 — Add-info header
   *     tags: [ActualOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     responses:
   *       200: { description: name/value rows }
   */
  @ValidatePermissions(READ)
  @httpGet('/:id/add-info', ParamValidation(HeaderParamDto))
  async getAddInfoHeader(@request() req: Request) {
    return await this.queryService.getAddInfoHeader(String(req.params.id));
  }

  /**
   * @swagger
   * /v1/actual-outgoing/detail/{detailId}/add-info:
   *   get:
   *     summary: Q5 — Add-info detail material
   *     tags: [ActualOutgoing]
   *     security: [{ bearerAuth: [] }, { api_key: [] }]
   *     responses:
   *       200: { description: name/value rows }
   */
  @ValidatePermissions(READ)
  @httpGet('/detail/:detailId/add-info', ParamValidation(DetailIdParamDto))
  async getAddInfoDetail(@request() req: Request) {
    return await this.queryService.getAddInfoDetail(
      String(req.params.detailId),
    );
  }
}
