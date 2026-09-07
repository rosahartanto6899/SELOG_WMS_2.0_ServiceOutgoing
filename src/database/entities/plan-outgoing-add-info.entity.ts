import { DataTypes, ModelDefined, Optional } from 'sequelize';
import { sequelize } from '@/utils/database.util';
import {
  PlanOutgoingHeaderAddInfoAttributes,
  PlanOutgoingDetailAddInfoAttributes,
} from '@/database/attributes';

type HeaderCreation = Optional<
  PlanOutgoingHeaderAddInfoAttributes,
  | 'id'
  | 'createdDate'
  | 'createdBy'
  | 'modifiedDate'
  | 'modifiedBy'
  | 'deletedBy'
  | 'deletedDate'
>;

const PlanOutgoingHeaderAddInfo: ModelDefined<
  PlanOutgoingHeaderAddInfoAttributes,
  HeaderCreation
> = sequelize.define(
  'PlanOutgoingHeaderAddInfo',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    planOutgoingHeaderId: { type: DataTypes.UUID, allowNull: true },
    // ponytail: Name(20) — batasan kolom DB legacy, jangan dinaikkan
    name: { type: DataTypes.STRING(20), allowNull: true },
    value: { type: DataTypes.STRING(100), allowNull: true },
    createdDate: { type: DataTypes.DATE, allowNull: true },
    createdBy: { type: DataTypes.STRING(100), allowNull: true },
    modifiedDate: { type: DataTypes.DATE, allowNull: true },
    modifiedBy: { type: DataTypes.STRING(100), allowNull: true },
    deletedBy: { type: DataTypes.STRING(100), allowNull: true },
    deletedDate: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: 'PlanOutgoingHeaderAddInfo',
    timestamps: false,
    indexes: [
      {
        name: 'idx_plan_outgoing_header_add_info_header_id',
        fields: ['planOutgoingHeaderId'],
      },
    ],
  },
);

type DetailCreation = Optional<
  PlanOutgoingDetailAddInfoAttributes,
  | 'id'
  | 'createdDate'
  | 'createdBy'
  | 'modifiedDate'
  | 'modifiedBy'
  | 'deletedBy'
  | 'deletedDate'
>;

const PlanOutgoingDetailAddInfo: ModelDefined<
  PlanOutgoingDetailAddInfoAttributes,
  DetailCreation
> = sequelize.define(
  'PlanOutgoingDetailAddInfo',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    planOutgoingDetailId: { type: DataTypes.UUID, allowNull: true },
    name: { type: DataTypes.STRING(75), allowNull: true },
    value: { type: DataTypes.STRING(100), allowNull: true },
    createdDate: { type: DataTypes.DATE, allowNull: true },
    createdBy: { type: DataTypes.STRING(100), allowNull: true },
    modifiedDate: { type: DataTypes.DATE, allowNull: true },
    modifiedBy: { type: DataTypes.STRING(100), allowNull: true },
    deletedBy: { type: DataTypes.STRING(100), allowNull: true },
    deletedDate: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: 'PlanOutgoingDetailAddInfo',
    timestamps: false,
    indexes: [
      {
        name: 'idx_plan_outgoing_detail_add_info_detail_id',
        fields: ['planOutgoingDetailId'],
      },
    ],
  },
);

export { PlanOutgoingHeaderAddInfo, PlanOutgoingDetailAddInfo };
