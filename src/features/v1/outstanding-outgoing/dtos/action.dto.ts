import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { OUTGOING_STATUS } from '../constants';

/**
 * @swagger
 * components:
 *   schemas:
 *     OutstandingOutgoingIdsActionDto:
 *       type: object
 *       required: [ids]
 *       properties:
 *         ids: { type: array, items: { type: string, format: uuid } }
 */
export class IdsActionDto {
  @IsArray({ message: 'Ids must be an array' })
  @IsUUID('4', { each: true, message: 'Each id must be a valid UUID' })
  ids!: string[];
}

/** A4 status whitelist — Transit khusus MUTATION+TRANS dicek command (parity JS legacy) */
export const A4_STATUS = [
  OUTGOING_STATUS.PICKING,
  OUTGOING_STATUS.QUALITY_CONTROL,
  OUTGOING_STATUS.TRANSIT_IN,
  OUTGOING_STATUS.TRANSIT_OUT,
] as const;

/**
 * @swagger
 * components:
 *   schemas:
 *     OutstandingOutgoingStatusDto:
 *       type: object
 *       required: [status]
 *       properties:
 *         status: { type: string, enum: [Picking, Quality Control, Transit In, Transit Out] }
 */
export class UpdateStatusDto {
  @IsIn([...A4_STATUS], {
    message: `Status must be one of: ${A4_STATUS.join(', ')}`,
  })
  status!: string;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     OutstandingOutgoingPlanQtyDto:
 *       type: object
 *       required: [planQty, description]
 *       properties:
 *         planQty: { type: integer, minimum: 1 }
 *         description: { type: string, description: "Di-append ke description existing (SP: + '. ')" }
 */
export class PlanQtyDto {
  @IsInt({ message: 'PlanQty must be an integer' })
  @Min(1, { message: 'PlanQty must be at least 1' })
  planQty!: number;

  @IsString({ message: 'Description must be a string' })
  description!: string;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     OutstandingOutgoingPickingDto:
 *       type: object
 *       properties:
 *         detailId: { type: string, format: uuid }
 *         actualQty: { type: integer, minimum: 0, description: "Total qty terpilih (0/null → default POQty, parity SP)" }
 *         materialBarcode: { type: string, description: "Divalidasi vs detail bila detail punya barcode" }
 *         locationBarcode: { type: string, description: "Divalidasi vs detail bila detail punya barcode" }
 */
export class PickingDto {
  @IsUUID('4', { message: 'DetailId must be a valid UUID' })
  detailId!: string;

  @IsOptional()
  @IsInt({ message: 'ActualQty must be an integer' })
  @Min(0, { message: 'ActualQty must be at least 0' })
  actualQty?: number;

  @IsOptional()
  @IsString({ message: 'MaterialBarcode must be a string' })
  materialBarcode?: string;

  @IsOptional()
  @IsString({ message: 'LocationBarcode must be a string' })
  locationBarcode?: string;
}

/**
 * A5 bulk sequential.
 * @swagger
 * components:
 *   schemas:
 *     OutstandingOutgoingBulkStatusDto:
 *       type: object
 *       required: [ids, status]
 *       properties:
 *         ids: { type: array, items: { type: string, format: uuid } }
 *         status: { type: string, enum: [Ready To Ship] }
 */
export class BulkStatusDto {
  @IsArray({ message: 'Ids must be an array' })
  @IsUUID('4', { each: true, message: 'Each id must be a valid UUID' })
  @ArrayMinSize(1, { message: 'Ids must not be empty' })
  ids!: string[];

  @IsIn(['Ready To Ship'], {
    message: 'Status must be Ready To Ship',
  })
  status!: string;
}

/** GET /sequential-config query */
export class SequentialConfigDto {
  @IsString({ message: 'CustomerCode must be a string' })
  customerCode!: string;
}
