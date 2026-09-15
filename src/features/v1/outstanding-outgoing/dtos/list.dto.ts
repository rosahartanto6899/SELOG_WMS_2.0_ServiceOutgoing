import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  LIST_ORDER_WHITELIST,
  LIST_SEARCHBY_COLUMNS,
} from '../constants';

/**
 * @swagger
 * components:
 *   schemas:
 *     OutstandingOutgoingListDto:
 *       type: object
 *       properties:
 *         page: { type: integer, minimum: 1, example: 1 }
 *         limit: { type: integer, minimum: 1, maximum: 100, example: 10 }
 *         search: { type: string, description: "LIKE gabung 6 kolom (parity SP)" }
 *         searchBy: { type: string, enum: [deliveryNoteNo, poNo, materialCode], description: "Advanced search popup legacy; materialCode → exact di detail" }
 *         customerCode: { type: string, description: Filter LIKE }
 *         warehouseCode: { type: string, description: Filter LIKE }
 *         deliveryNoteNoFilter: { type: string, description: Filter LIKE }
 *         order: { type: string, enum: [id, deliveryNoteNo, outgoingDate, poNo, poType, poDate, customerDestination, referenceNo, description, status, createdAt, createdBy] }
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
  @IsIn([...LIST_SEARCHBY_COLUMNS], {
    message: `SearchBy must be one of: ${LIST_SEARCHBY_COLUMNS.join(', ')}`,
  })
  searchBy?: string;

  @IsOptional()
  @IsString({ message: 'CustomerCode must be a string' })
  customerCode?: string;

  @IsOptional()
  @IsString({ message: 'WarehouseCode must be a string' })
  warehouseCode?: string;

  @IsOptional()
  @IsString({ message: 'DeliveryNoteNoFilter must be a string' })
  deliveryNoteNoFilter?: string;

  @IsOptional()
  @IsString({ message: 'Order must be a string' })
  @IsIn(Object.keys(LIST_ORDER_WHITELIST), {
    message: `Order must be one of: ${Object.keys(LIST_ORDER_WHITELIST).join(', ')}`,
  })
  order?: string;

  @IsOptional()
  @IsString({ message: 'Sort must be a string' })
  @IsIn(['asc', 'desc'], { message: 'Sort must be either asc or desc' })
  sort?: string;
}

const csvToArray = ({ value }: { value: unknown }) =>
  value === undefined || value === null || Array.isArray(value)
    ? value
    : String(value)
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v !== '');

/**
 * @swagger
 * components:
 *   schemas:
 *     OutstandingOutgoingTotalsDto:
 *       type: object
 *       required: [warehouseCodes]
 *       properties:
 *         customerCode: { type: string }
 *         warehouseCodes: { type: array, items: { type: string }, description: "CSV/array kode gudang" }
 */
export class TotalsDto {
  @IsOptional()
  @IsString({ message: 'CustomerCode must be a string' })
  customerCode?: string;

  @Transform(csvToArray)
  @IsArray({ message: 'WarehouseCodes must be an array or csv' })
  @IsString({ each: true, message: 'Each warehouseCode must be a string' })
  @ArrayMinSize(1, { message: 'WarehouseCodes must not be empty' })
  warehouseCodes!: string[];
}

/**
 * @swagger
 * components:
 *   schemas:
 *     OutstandingOutgoingIndicatorDto:
 *       type: object
 *       required: [customerCode, warehouseCode]
 *       properties:
 *         customerCode: { type: string }
 *         warehouseCode: { type: string }
 */
export class IndicatorDto {
  @IsString({ message: 'CustomerCode must be a string' })
  customerCode!: string;

  @IsString({ message: 'WarehouseCode must be a string' })
  warehouseCode!: string;
}

/**
 * Q2/Q3/Q4 — filter tab DN Items / Packaging / Shipment (parity RequestMstDto
 * legacy: customerCode+warehouseCode exact; tanpa paging — list penuh,
 * paginasi client-side parity DataTables legacy).
 * @swagger
 * components:
 *   schemas:
 *     OutstandingOutgoingItemsQueryDto:
 *       type: object
 *       required: [customerCode, warehouseCode]
 *       properties:
 *         customerCode: { type: string }
 *         warehouseCode: { type: string }
 *         search: { type: string, description: "LIKE client helper (opsional)" }
 */
const ITEMS_ORDER_WHITELIST = [
  'materialCode',
  'materialName',
  'materialBrand',
  'uom',
  'poQty',
  'pickingQty',
  'deliveryNoteNo',
  'poNo',
  'customerDestination',
  'createdAt',
] as const;

/** Q3 — whitelist search/sort tab Packaging (row per packagingNo) */
const PACKAGING_QUERY_WHITELIST = [
  'packagingNo',
  'materialCode',
  'materialName',
  'customerDestination',
  'qty',
  'createdAt',
] as const;

/** Q4 — whitelist search/sort tab Shipment (row per shipmentNo) */
const SHIPMENT_QUERY_WHITELIST = [
  'shipmentNo',
  'customerDestination',
  'modifiedDate',
] as const;

/** Q5 — whitelist search/sort popup PO per packaging */
const PO_BY_PACKAGING_WHITELIST = [
  'deliveryNoteNo',
  'poNo',
  'customerDestination',
  'materialCode',
  'materialName',
  'materialBrand',
] as const;

/** Q6 — whitelist search/sort popup packaging per shipment */
const PACKAGING_BY_SHIPMENT_WHITELIST = [
  'packagingNo',
  'customerDestination',
  'materialCode',
  'materialName',
  'materialBrand',
] as const;

/** Base query paging/sort untuk popup Q5/Q6 (param utk di path) */
abstract class PopupQueryDto {
  @IsOptional()
  @IsString({ message: 'Search must be a string' })
  search?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'Sort must be either asc or desc' })
  sort?: string;

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
}

/**
 * Q2 — tab DN Items (server-side parity Q1: paging, search, searchBy, sort).
 * @swagger
 * components:
 *   schemas:
 *     OutstandingOutgoingItemsQueryDto:
 *       type: object
 *       required: [customerCode, warehouseCode]
 *       properties:
 *         customerCode: { type: string }
 *         warehouseCode: { type: string }
 *         search: { type: string, description: "LIKE gabung: material* + header DN/PO/destination" }
 *         searchBy: { type: string, enum: [materialCode, materialName, materialBrand, uom, poQty, pickingQty, deliveryNoteNo, poNo, customerDestination, createdAt] }
 *         order: { type: string, enum: [materialCode, materialName, materialBrand, uom, poQty, pickingQty, deliveryNoteNo, poNo, customerDestination, createdAt] }
 *         sort: { type: string, enum: [asc, desc] }
 *         page: { type: integer, minimum: 1 }
 *         limit: { type: integer, minimum: 1, maximum: 100 }
 */
export class ItemsQueryDto {
  @IsString({ message: 'CustomerCode must be a string' })
  customerCode!: string;

  @IsString({ message: 'WarehouseCode must be a string' })
  warehouseCode!: string;

  @IsOptional()
  @IsString({ message: 'Search must be a string' })
  search?: string;

  @IsOptional()
  @IsIn([...ITEMS_ORDER_WHITELIST], {
    message: `SearchBy must be one of: ${ITEMS_ORDER_WHITELIST.join(', ')}`,
  })
  searchBy?: string;

  @IsOptional()
  @IsIn([...ITEMS_ORDER_WHITELIST], {
    message: `Order must be one of: ${ITEMS_ORDER_WHITELIST.join(', ')}`,
  })
  order?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'Sort must be either asc or desc' })
  sort?: string;

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
}

/**
 * Q3 — tab Packaging (server-side parity Q2: paging, search, searchBy, sort).
 */
export class PackagingQueryDto {
  @IsString({ message: 'CustomerCode must be a string' })
  customerCode!: string;

  @IsString({ message: 'WarehouseCode must be a string' })
  warehouseCode!: string;

  @IsOptional()
  @IsString({ message: 'Search must be a string' })
  search?: string;

  @IsOptional()
  @IsIn([...PACKAGING_QUERY_WHITELIST], {
    message: `SearchBy must be one of: ${PACKAGING_QUERY_WHITELIST.join(', ')}`,
  })
  searchBy?: string;

  @IsOptional()
  @IsIn([...PACKAGING_QUERY_WHITELIST], {
    message: `Order must be one of: ${PACKAGING_QUERY_WHITELIST.join(', ')}`,
  })
  order?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'Sort must be either asc or desc' })
  sort?: string;

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
}

/**
 * Q4 — tab Shipment (server-side parity Q2/Q3).
 */
export class ShipmentQueryDto {
  @IsString({ message: 'CustomerCode must be a string' })
  customerCode!: string;

  @IsString({ message: 'WarehouseCode must be a string' })
  warehouseCode!: string;

  @IsOptional()
  @IsString({ message: 'Search must be a string' })
  search?: string;

  @IsOptional()
  @IsIn([...SHIPMENT_QUERY_WHITELIST], {
    message: `SearchBy must be one of: ${SHIPMENT_QUERY_WHITELIST.join(', ')}`,
  })
  searchBy?: string;

  @IsOptional()
  @IsIn([...SHIPMENT_QUERY_WHITELIST], {
    message: `Order must be one of: ${SHIPMENT_QUERY_WHITELIST.join(', ')}`,
  })
  order?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'Sort must be either asc or desc' })
  sort?: string;

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
}

/**
 * Q5 — popup PO per packaging (server-side: paging, search, searchBy, sort).
 */
export class PoByPackagingQueryDto extends PopupQueryDto {
  @IsOptional()
  @IsIn([...PO_BY_PACKAGING_WHITELIST], {
    message: `SearchBy must be one of: ${PO_BY_PACKAGING_WHITELIST.join(', ')}`,
  })
  searchBy?: string;

  @IsOptional()
  @IsIn([...PO_BY_PACKAGING_WHITELIST], {
    message: `Order must be one of: ${PO_BY_PACKAGING_WHITELIST.join(', ')}`,
  })
  order?: string;
}

/**
 * Q6 — popup packaging per shipment (server-side parity Q5).
 */
export class PackagingByShipmentQueryDto extends PopupQueryDto {
  @IsOptional()
  @IsIn([...PACKAGING_BY_SHIPMENT_WHITELIST], {
    message: `SearchBy must be one of: ${PACKAGING_BY_SHIPMENT_WHITELIST.join(', ')}`,
  })
  searchBy?: string;

  @IsOptional()
  @IsIn([...PACKAGING_BY_SHIPMENT_WHITELIST], {
    message: `Order must be one of: ${PACKAGING_BY_SHIPMENT_WHITELIST.join(', ')}`,
  })
  order?: string;
}

/** Param `:materialCode` plan-qty (bukan UUID — kode material bebas) */
export class MaterialCodeParamDto {
  @IsString({ message: 'MaterialCode must be a string' })
  materialCode!: string;
}
