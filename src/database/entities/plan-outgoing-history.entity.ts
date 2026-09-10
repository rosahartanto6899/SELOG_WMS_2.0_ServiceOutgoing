import { DataTypes, ModelDefined, Optional } from 'sequelize';
import { sequelize } from '@/utils/database.util';
import { PlanOutgoingHistoryAttributes } from '@/database/attributes';

type Creation = Optional<
  PlanOutgoingHistoryAttributes,
  'id' | 'planOutgoingHeaderId' | 'status' | 'date' | 'leadtime' | 'pic' | 'createdDate' | 'createdBy'
>;

const tableName = 'PlanOutgoingHistory';

/** Skema verified INFORMATION_SCHEMA wms-outgoing-dev (2026-09-08, spec 004).
 *  Kolom Date bertipe datetime (bukan datetimeoffset). */
const PlanOutgoingHistory: ModelDefined<
  PlanOutgoingHistoryAttributes,
  Creation
> = sequelize.define(
  tableName,
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    planOutgoingHeaderId: { type: DataTypes.STRING(36), allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: true },
    date: { type: DataTypes.DATE, allowNull: true },
    leadtime: { type: DataTypes.INTEGER, allowNull: true },
    pic: { type: DataTypes.STRING(75), allowNull: true },
    createdDate: { type: DataTypes.DATE, allowNull: true },
    createdBy: { type: DataTypes.STRING(100), allowNull: true },
  },
  {
    tableName,
    timestamps: false,
    indexes: [
      { name: 'idx_plan_outgoing_history_header_id', fields: ['planOutgoingHeaderId'] },
    ],
  },
);

export { PlanOutgoingHistory };
