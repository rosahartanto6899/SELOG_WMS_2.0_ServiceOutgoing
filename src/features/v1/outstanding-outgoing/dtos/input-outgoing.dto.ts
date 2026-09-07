import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Param `:id` (UUID header/detail) */
export class HeaderParamDto {
  @IsUUID('4', { message: 'Id must be a valid UUID' })
  id!: string;
}

export class DetailIdParamDto {
  @IsUUID('4', { message: 'Id must be a valid UUID' })
  id!: string;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     OutstandingOutgoingAddInfoDto:
 *       type: object
 *       properties:
 *         name: { type: string, example: "batch", maxLength: 75 }
 *         value: { type: string, example: "B-01", maxLength: 100 }
 */
export class AddInfoDto {
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @MaxLength(75)
  name?: string;

  @IsOptional()
  @IsString({ message: 'Value must be a string' })
  @MaxLength(100)
  value?: string;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     OutstandingOutgoingDetailRowDto:
 *       type: object
 *       required: [materialCode, materialName, materialBrand, uom, qty]
 *       properties:
 *         materialCode: { type: string }
 *         materialName: { type: string }
 *         materialBrand: { type: string }
 *         uom: { type: string }
 *         qty: { type: integer, minimum: 1 }
 *         barcode: { type: string }
 *         locationBarcode: { type: string }
 *         additionalInformation: { type: array, items: { $ref: '#/components/schemas/OutstandingOutgoingAddInfoDto' } }
 */
export class DetailRowDto {
  @IsString({ message: 'MaterialCode must be a string' })
  @MaxLength(100)
  materialCode!: string;

  @IsString({ message: 'MaterialName must be a string' })
  materialName!: string;

  @IsString({ message: 'MaterialBrand must be a string' })
  materialBrand!: string;

  @IsString({ message: 'Uom must be a string' })
  uom!: string;

  @IsInt({ message: 'Qty must be an integer' })
  @Min(1, { message: 'Qty must be at least 1' })
  qty!: number;

  @IsOptional()
  @IsString({ message: 'Barcode must be a string' })
  barcode?: string;

  @IsOptional()
  @IsString({ message: 'LocationBarcode must be a string' })
  locationBarcode?: string;

  @IsOptional()
  @IsArray({ message: 'AdditionalInformation must be an array' })
  @ValidateNested({ each: true })
  @Type(() => AddInfoDto)
  additionalInformation?: AddInfoDto[];
}

/**
 * @swagger
 * components:
 *   schemas:
 *     OutstandingOutgoingCreateDto:
 *       type: object
 *       required: [customerCode, customerName, warehouseCode, warehouseName, poNo, deliveryNoteNo, details]
 *       properties:
 *         customerCode: { type: string }
 *         customerName: { type: string }
 *         warehouseCode: { type: string }
 *         warehouseName: { type: string }
 *         poNo: { type: string }
 *         poType: { type: string }
 *         poDate: { type: string, example: "2026-01-01" }
 *         deliveryNoteNo: { type: string }
 *         outgoingDate: { type: string, example: "2026-01-02" }
 *         customerDestination: { type: string }
 *         referenceNo: { type: string }
 *         materialCategory: { type: string, example: "Part" }
 *         description: { type: string }
 *         additionalInformation: { type: array, items: { $ref: '#/components/schemas/OutstandingOutgoingAddInfoDto' } }
 *         details: { type: array, items: { $ref: '#/components/schemas/OutstandingOutgoingDetailRowDto' } }
 */
export class CreateOutgoingDto {
  @IsString({ message: 'CustomerCode must be a string' })
  customerCode!: string;

  @IsString({ message: 'CustomerName must be a string' })
  customerName!: string;

  @IsString({ message: 'WarehouseCode must be a string' })
  warehouseCode!: string;

  @IsString({ message: 'WarehouseName must be a string' })
  warehouseName!: string;

  @IsString({ message: 'PoNo must be a string' })
  poNo!: string;

  @IsOptional()
  @IsString({ message: 'PoType must be a string' })
  poType?: string;

  @IsOptional()
  @IsString({ message: 'PoDate must be a string' })
  poDate?: string;

  @IsString({ message: 'DeliveryNoteNo must be a string' })
  deliveryNoteNo!: string;

  @IsOptional()
  @IsString({ message: 'OutgoingDate must be a string' })
  outgoingDate?: string;

  @IsOptional()
  @IsString({ message: 'CustomerDestination must be a string' })
  customerDestination?: string;

  @IsOptional()
  @IsString({ message: 'ReferenceNo must be a string' })
  referenceNo?: string;

  @IsOptional()
  @IsString({ message: 'MaterialCategory must be a string' })
  materialCategory?: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;

  @IsOptional()
  @IsArray({ message: 'AdditionalInformation must be an array' })
  @ValidateNested({ each: true })
  @Type(() => AddInfoDto)
  additionalInformation?: AddInfoDto[];

  @IsArray({ message: 'Details must be an array' })
  @ValidateNested({ each: true })
  @Type(() => DetailRowDto)
  details!: DetailRowDto[];
}

/** C2 body — array baris material */
export class AddDetailDto {
  @IsArray({ message: 'Details must be an array' })
  @ValidateNested({ each: true })
  @Type(() => DetailRowDto)
  details!: DetailRowDto[];
}

/**
 * @swagger
 * components:
 *   schemas:
 *     OutstandingOutgoingUpdateHeaderDto:
 *       type: object
 *       description: Edit header (C3) — field sama seperti create, add-info replace
 */
export class UpdateOutgoingHeaderDto {
  @IsOptional()
  @IsString({ message: 'CustomerCode must be a string' })
  customerCode?: string;

  @IsOptional()
  @IsString({ message: 'CustomerName must be a string' })
  customerName?: string;

  @IsOptional()
  @IsString({ message: 'WarehouseCode must be a string' })
  warehouseCode?: string;

  @IsOptional()
  @IsString({ message: 'WarehouseName must be a string' })
  warehouseName?: string;

  @IsOptional()
  @IsString({ message: 'PoNo must be a string' })
  poNo?: string;

  @IsOptional()
  @IsString({ message: 'PoType must be a string' })
  poType?: string;

  @IsOptional()
  @IsString({ message: 'PoDate must be a string' })
  poDate?: string;

  @IsOptional()
  @IsString({ message: 'DeliveryNoteNo must be a string' })
  deliveryNoteNo?: string;

  @IsOptional()
  @IsString({ message: 'OutgoingDate must be a string' })
  outgoingDate?: string;

  @IsOptional()
  @IsString({ message: 'CustomerDestination must be a string' })
  customerDestination?: string;

  @IsOptional()
  @IsString({ message: 'ReferenceNo must be a string' })
  referenceNo?: string;

  @IsOptional()
  @IsString({ message: 'MaterialCategory must be a string' })
  materialCategory?: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;

  @IsOptional()
  @IsArray({ message: 'AdditionalInformation must be an array' })
  @ValidateNested({ each: true })
  @Type(() => AddInfoDto)
  additionalInformation?: AddInfoDto[];
}

/** C4 body — qty + add-info replace */
export class UpdateOutgoingDetailDto {
  @IsInt({ message: 'Qty must be an integer' })
  @Min(1, { message: 'Qty must be at least 1' })
  qty!: number;

  @IsOptional()
  @IsArray({ message: 'AdditionalInformation must be an array' })
  @ValidateNested({ each: true })
  @Type(() => AddInfoDto)
  additionalInformation?: AddInfoDto[];
}
