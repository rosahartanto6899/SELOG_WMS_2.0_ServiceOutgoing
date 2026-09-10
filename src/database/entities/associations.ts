import { PlanOutgoingHeader } from './plan-outgoing-header.entity';
import { PlanOutgoingDetail } from './plan-outgoing-detail.entity';
import {
  PlanOutgoingHeaderAddInfo,
  PlanOutgoingDetailAddInfo,
} from './plan-outgoing-add-info.entity';
import { PlanOutgoingPackaging } from './plan-outgoing-packaging.entity';
import { PlanOutgoingHistory } from './plan-outgoing-history.entity';

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

  // spec 004: ref string packagingNo (tanpa FK — parity SP legacy)
  PlanOutgoingDetail.belongsTo(PlanOutgoingPackaging, {
    foreignKey: 'packagingNo',
    targetKey: 'packagingNo',
    as: 'packaging',
  });

  PlanOutgoingPackaging.hasMany(PlanOutgoingDetail, {
    foreignKey: 'packagingNo',
    sourceKey: 'packagingNo',
    as: 'details',
  });

  PlanOutgoingHeader.hasMany(PlanOutgoingHistory, {
    foreignKey: 'planOutgoingHeaderId',
    as: 'histories',
  });
}
