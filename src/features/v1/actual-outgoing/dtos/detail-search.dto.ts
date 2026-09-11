import { IsIn, IsOptional, IsString } from 'class-validator';
import { ACTUAL_DETAIL_SEARCH_WHITELIST } from '../constants';

/**
 * @swagger
 * components:
 *   schemas:
 *     ActualOutgoingDetailSearchDto:
 *       type: object
 *       properties:
 *         search: { type: string, description: LIKE keyword }
 *         searchBy: { type: string, description: Whitelist ACTUAL_DETAIL_SEARCH_WHITELIST }
 */
export class DetailSearchDto {
  @IsOptional()
  @IsString({ message: 'Search must be a string' })
  search?: string;

  @IsOptional()
  @IsString({ message: 'SearchBy must be a string' })
  @IsIn([...ACTUAL_DETAIL_SEARCH_WHITELIST], {
    message: `SearchBy must be one of: ${ACTUAL_DETAIL_SEARCH_WHITELIST.join(', ')}`,
  })
  searchBy?: string;
}
