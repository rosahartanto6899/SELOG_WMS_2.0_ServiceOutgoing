import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  OUTGOING_REPORT_ORDER_WHITELIST,
  OUTGOING_REPORT_SEARCH_COLUMNS,
} from '../constants';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @swagger
 * components:
 *   schemas:
 *     OutgoingReportListDto:
 *       type: object
 *       required: [startDate, endDate]
 *       properties:
 *         page: { type: integer, minimum: 1, example: 1 }
 *         limit: { type: integer, minimum: 1, maximum: 100, example: 10 }
 *         search: { type: string, example: "BRG-001" }
 *         searchBy: { type: string, enum: [materialCode, materialName, materialBrand, deliveryNoteNo] }
 *         startDate: { type: string, format: date, example: "2026-09-15" }
 *         endDate: { type: string, format: date, example: "2026-09-15" }
 *         order: { type: string, enum: [materialCode, materialName, materialBrand, actualQty, uom, deliveryNoteNo, poDate] }
 *         sort: { type: string, enum: [asc, desc] }
 */
export class OutgoingReportListDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit must be at most 100' })
  limit?: number;

  @IsOptional()
  @IsString({ message: 'Search must be a string' })
  search?: string;

  @IsOptional()
  @IsString({ message: 'SearchBy must be a string' })
  @IsIn([...OUTGOING_REPORT_SEARCH_COLUMNS], {
    message: `SearchBy must be one of: ${OUTGOING_REPORT_SEARCH_COLUMNS.join(', ')}`,
  })
  searchBy?: string;

  @IsDefined({ message: 'StartDate is required' })
  @IsString({ message: 'StartDate must be a string' })
  @Matches(DATE_PATTERN, { message: 'StartDate must be YYYY-MM-DD' })
  startDate!: string;

  @IsDefined({ message: 'EndDate is required' })
  @IsString({ message: 'EndDate must be a string' })
  @Matches(DATE_PATTERN, { message: 'EndDate must be YYYY-MM-DD' })
  endDate!: string;

  @IsOptional()
  @IsString({ message: 'Order must be a string' })
  @IsIn(Object.keys(OUTGOING_REPORT_ORDER_WHITELIST), {
    message: `Order must be one of: ${Object.keys(OUTGOING_REPORT_ORDER_WHITELIST).join(', ')}`,
  })
  order?: string;

  @IsOptional()
  @IsString({ message: 'Sort must be a string' })
  @IsIn(['asc', 'desc'], { message: 'Sort must be either asc or desc' })
  sort?: string;
}
