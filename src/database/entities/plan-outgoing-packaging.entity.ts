import { DataTypes, ModelDefined, Optional } from 'sequelize';
import { sequelize } from '@/utils/database.util';
import { PlanOutgoingPackagingAttributes } from '@/database/attributes';

type Creation = Optional<
  PlanOutgoingPackagingAttributes,
  | 'id'
  | 'packagingNo'
  | 'shipmentNo'
  | 'customerDestination'
  | 'materialCode'
  | 'materialName'
  | 'materialBrand'
  | 'qty'
  | 'uom'
  | 'weight'
  | 'length'
  | 'width'
  | 'height'
  | 'isActive'
  | 'createdDate'
  | 'createdBy'
  | 'modifiedDate'
  | 'modifiedBy'
  | 'deletedBy'
  | 'deletedDate'
>;

const tableName = 'PlanOutgoingPackaging';

/** Skema verified INFORMATION_SCHEMA wms-outgoing-dev (2026-09-08, spec 004). */
const PlanOutgoingPackaging: ModelDefined<
  PlanOutgoingPackagingAttributes,
  Creation
> = sequelize.define(
  tableName,
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    packagingNo: { type: DataTypes.STRING(50), allowNull: true },
    shipmentNo: { type: DataTypes.STRING(50), allowNull: true },
    customerDestination: { type: DataTypes.STRING(100), allowNull: true },
    materialCode: { type: DataTypes.STRING(100), allowNull: true },
    materialName: { type: DataTypes.STRING(200), allowNull: true },
    materialBrand: { type: DataTypes.STRING(100), allowNull: true },
    qty: { type: DataTypes.INTEGER, allowNull: true },
    uom: { type: DataTypes.STRING(20), allowNull: true },
    weight: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    length: { type: DataTypes.INTEGER, allowNull: true },
    width: { type: DataTypes.INTEGER, allowNull: true },
    height: { type: DataTypes.INTEGER, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: true },
    createdDate: { type: DataTypes.DATE, allowNull: true },
    createdBy: { type: DataTypes.STRING(100), allowNull: true },
    modifiedDate: { type: DataTypes.DATE, allowNull: true },
    modifiedBy: { type: DataTypes.STRING(100), allowNull: true },
    deletedBy: { type: DataTypes.STRING(100), allowNull: true },
    deletedDate: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName,
    timestamps: false,
    indexes: [
      { name: 'idx_plan_outgoing_packaging_no', fields: ['packagingNo'] },
      { name: 'idx_plan_outgoing_packaging_shipment_no', fields: ['shipmentNo'] },
    ],
  },
);

export { PlanOutgoingPackaging };
