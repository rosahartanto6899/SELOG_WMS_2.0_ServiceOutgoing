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
} from './dtos';

const READ = { menuCode: cst.menuCode, action: 'READ' };
const CREATE = { menuCode: cst.menuCode, action: 'CREATE' };
const UPDATE = { menuCode: cst.menuCode, action: 'UPDATE' };

/**
 * @swagger
 * tags:
 *   - name: OutstandingOutgoing
 *     description: Input plan outgoing (C1–C4, C6) — parity ServiceIncoming input manual
 */
@controller('/v1/outstanding-outgoing')
export class OutstandingOutgoingController extends BaseHttpController {
  constructor(
    @inject(QueryService) private readonly queryService: QueryService,
    @inject(CommandService) private readonly commandService: CommandService,
  ) {
    super();
  }

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
