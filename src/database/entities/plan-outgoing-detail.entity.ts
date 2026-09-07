import { DataTypes, ModelDefined, Optional } from 'sequelize';
import { sequelize } from '@/utils/database.util';
import { PlanOutgoingDetailAttributes } from '@/database/attributes';

type Creation = Optional<
  PlanOutgoingDetailAttributes,
  | 'id'
  | 'pickingQty'
  | 'pickingDate'
  | 'packagingNo'
  | 'createdDate'
  | 'createdBy'
  | 'modifiedDate'
  | 'modifiedBy'
  | 'deletedBy'
  | 'deletedDate'
>;

const tableName = 'PlanOutgoingDetail';

const PlanOutgoingDetail: ModelDefined<
  PlanOutgoingDetailAttributes,
  Creation
> = sequelize.define(
  tableName,
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    planOutgoingHeaderId: { type: DataTypes.UUID, allowNull: false },
    materialCode: { type: DataTypes.STRING(100), allowNull: false },
    materialName: { type: DataTypes.STRING(200), allowNull: false },
    materialBrand: { type: DataTypes.STRING(100), allowNull: false },
    materialBarcode: { type: DataTypes.STRING(50), allowNull: true },
    materialLocationBarcode: { type: DataTypes.STRING(12), allowNull: true },
    uom: { type: DataTypes.STRING(20), allowNull: false },
    poQty: { type: DataTypes.INTEGER, allowNull: false },
    pickingQty: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    pickingDate: { type: DataTypes.DATE, allowNull: true },
    description: { type: DataTypes.STRING(500), allowNull: true },
    packagingNo: { type: DataTypes.STRING(50), allowNull: true },
    createdDate: { type: DataTypes.DATE, allowNull: false },
    createdBy: { type: DataTypes.STRING(100), allowNull: false },
    modifiedDate: { type: DataTypes.DATE, allowNull: true },
    modifiedBy: { type: DataTypes.STRING(100), allowNull: true },
    deletedBy: { type: DataTypes.STRING(100), allowNull: true },
    deletedDate: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName,
    timestamps: false,
    indexes: [
      {
        name: 'idx_plan_outgoing_detail_header_id',
        fields: ['planOutgoingHeaderId'],
      },
      {
        name: 'idx_plan_outgoing_detail_material_code',
        fields: ['materialCode'],
      },
    ],
  },
);

export { PlanOutgoingDetail };
