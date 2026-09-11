import { IsUUID } from 'class-validator';

/** Param `:id` (UUID header actual outgoing) */
export class HeaderParamDto {
  @IsUUID('4', { message: 'Id must be a valid UUID' })
  id!: string;
}

/** Param `:detailId` (UUID detail material) */
export class DetailIdParamDto {
  @IsUUID('4', { message: 'DetailId must be a valid UUID' })
  detailId!: string;
}