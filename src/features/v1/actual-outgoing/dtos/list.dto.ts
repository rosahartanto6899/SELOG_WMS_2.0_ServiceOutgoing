import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  ACTUAL_LIST_ORDER_WHITELIST,
  ACTUAL_LIST_SEARCHBY_COLUMNS,
} from '../constants';

/**
 * @swagger
 * components:
 *   schemas:
 *     ActualOutgoingListDto:
 *       type: object
 *       properties:
 *         page: { type: integer, minimum: 1, example: 1 }
 *         limit: { type: integer, minimum: 1, maximum: 100, example: 10 }
 *         search: { type: string, description: LIKE gabung 6 kolom }
 *         searchBy: { type: string, description: LIKE satu kolom (whitelist) }
 *         customerCode: { type: string, description: exact (dari token) }
 *         warehouseCode: { type: string, description: exact }
 *         order: { type: string, description: whitelist ACTUAL_LIST_ORDER_WHITELIST }
 *         sort: { type: string, enum: [asc, desc] }
 */
export class ListDto {
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
  @IsIn([...ACTUAL_LIST_SEARCHBY_COLUMNS], {
    message: `SearchBy must be one of: ${ACTUAL_LIST_SEARCHBY_COLUMNS.join(', ')}`,
  })
  searchBy?: string;

  @IsOptional()
  @IsString({ message: 'CustomerCode must be a string' })
  customerCode?: string;

  @IsOptional()
  @IsString({ message: 'WarehouseCode must be a string' })
  warehouseCode?: string;

  @IsOptional()
  @IsString({ message: 'Order must be a string' })
  @IsIn(Object.keys(ACTUAL_LIST_ORDER_WHITELIST), {
    message: `Order must be one of: ${Object.keys(ACTUAL_LIST_ORDER_WHITELIST).join(', ')}`,
  })
  order?: string;

  @IsOptional()
  @IsString({ message: 'Sort must be a string' })
  @IsIn(['asc', 'desc'], { message: 'Sort must be asc or desc' })
  sort?: string;
}
