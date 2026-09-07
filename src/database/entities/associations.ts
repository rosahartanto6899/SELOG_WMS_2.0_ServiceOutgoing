import { PlanOutgoingHeader } from './plan-outgoing-header.entity';
import { PlanOutgoingDetail } from './plan-outgoing-detail.entity';
import {
  PlanOutgoingHeaderAddInfo,
  PlanOutgoingDetailAddInfo,
} from './plan-outgoing-add-info.entity';

export function setupAssociations() {
  PlanOutgoingHeader.hasMany(PlanOutgoingDetail, {
    foreignKey: 'planOutgoingHeaderId',
    as: 'details',
  });

  PlanOutgoingDetail.belongsTo(PlanOutgoingHeader, {
    foreignKey: 'planOutgoingHeaderId',
    as: 'header',
  });

  PlanOutgoingHeader.hasMany(PlanOutgoingHeaderAddInfo, {
    foreignKey: 'planOutgoingHeaderId',
    as: 'addInfos',
  });

  PlanOutgoingDetail.hasMany(PlanOutgoingDetailAddInfo, {
    foreignKey: 'planOutgoingDetailId',
    as: 'addInfos',
  });
}
