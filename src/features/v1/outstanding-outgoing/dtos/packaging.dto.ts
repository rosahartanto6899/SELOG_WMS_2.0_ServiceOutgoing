import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * @swagger
 * components:
 *   schemas:
 *     OutstandingOutgoingPackagingRowDto:
 *       type: object
 *       required: [materialCode, qty]
 *       properties:
 *         materialCode: { type: string }
 *         materialName: { type: string }
 *         materialBrand: { type: string }
 *         uom: { type: string }
 *         qty: { type: integer, minimum: 1 }
 *         weight: { type: integer, description: kg (default 0 parity SP ISNULL) }
 *         length: { type: integer }
 *         width: { type: integer }
 *         height: { type: integer }
 *         customerDestination: { type: string }
 */
export class PackagingRowDto {
  @IsString({ message: 'MaterialCode must be a string' })
  materialCode!: string;

  @IsOptional()
  @IsString({ message: 'MaterialName must be a string' })
  materialName?: string;

  @IsOptional()
  @IsString({ message: 'MaterialBrand must be a string' })
  materialBrand?: string;

  @IsOptional()
  @IsString({ message: 'Uom must be a string' })
  uom?: string;

  @IsInt({ message: 'Qty must be an integer' })
  @Min(1, { message: 'Qty must be at least 1' })
  qty!: number;

  @IsOptional()
  @IsInt({ message: 'Weight must be an integer' })
  weight?: number;

  @IsOptional()
  @IsInt({ message: 'Length must be an integer' })
  length?: number;

  @IsOptional()
  @IsInt({ message: 'Width must be an integer' })
  width?: number;

  @IsOptional()
  @IsInt({ message: 'Height must be an integer' })
  height?: number;

  @IsOptional()
  @IsString({ message: 'CustomerDestination must be a string' })
  customerDestination?: string;
}

/**
 * A8 body — 1 PackagingNo per grup materialCode (PKG+8char random unik,
 *  parity generateShipmentNos ServiceOrder LOGIS); respons { packagingNos[] }.
 * @swagger
 * components:
 *   schemas:
 *     OutstandingOutgoingCreatePackagingDto:
 *       type: object
 *       required: [detailIds, packagings]
 *       properties:
 *         detailIds: { type: array, items: { type: string, format: uuid } }
 *         packagings: { type: array, items: { $ref: '#/components/schemas/OutstandingOutgoingPackagingRowDto' } }
 */
export class CreatePackagingDto {
  @IsArray({ message: 'DetailIds must be an array' })
  @IsUUID('4', { each: true, message: 'Each detailId must be a valid UUID' })
  @ArrayMinSize(1, { message: 'DetailIds must not be empty' })
  detailIds!: string[];

  @IsArray({ message: 'Packagings must be an array' })
  @ValidateNested({ each: true })
  @Type(() => PackagingRowDto)
  @ArrayMinSize(1, { message: 'Packagings must not be empty' })
  packagings!: PackagingRowDto[];
}

/**
 * A9 body.
 * @swagger
 * components:
 *   schemas:
 *     OutstandingOutgoingReadyToShipDto:
 *       type: object
 *       required: [packagingNos]
 *       properties:
 *         packagingNos: { type: array, items: { type: string } }
 */
export class ReadyToShipDto {
  @IsArray({ message: 'PackagingNos must be an array' })
  @IsString({ each: true, message: 'Each packagingNo must be a string' })
  @ArrayMinSize(1, { message: 'PackagingNos must not be empty' })
  packagingNos!: string[];
}

/** Param :packagingNo / :shipmentNo (bukan UUID) */
export class PackagingNoParamDto {
  @IsString({ message: 'PackagingNo must be a string' })
  packagingNo!: string;
}

export class ShipmentNoParamDto {
  @IsString({ message: 'ShipmentNo must be a string' })
  shipmentNo!: string;
}
