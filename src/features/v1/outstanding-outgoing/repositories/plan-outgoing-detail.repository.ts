import { injectable } from 'inversify';
import { Transaction } from 'sequelize';
import {
  PlanOutgoingDetail,
  PlanOutgoingDetailAddInfo,
} from '@/database/entities';
import { PlanOutgoingDetailAttributes } from '@/database/attributes';
import { nowWib } from '@/utils';
import { filterAddInfos } from '../constants';

/** Detail CRUD + add-info replace (C2/C4/C6) */
@injectable()
export class PlanOutgoingDetailRepository {
  public async getById(id: string, transaction?: Transaction) {
    return PlanOutgoingDetail.findByPk(id, { transaction });
  }

  public async getByHeaderAndMaterial(
    headerId: string,
    materialCode: string,
    transaction?: Transaction,
  ) {
    return PlanOutgoingDetail.findOne({
      where: { planOutgoingHeaderId: headerId, materialCode },
      transaction,
    });
  }

  public async create(
    data: PlanOutgoingDetailAttributes,
    transaction?: Transaction,
  ) {
    return PlanOutgoingDetail.create(data, { transaction });
  }

  public async update(
    id: string,
    data: Partial<PlanOutgoingDetailAttributes>,
    transaction?: Transaction,
  ) {
    await PlanOutgoingDetail.update(data, { where: { id }, transaction });
  }

  /** Add-info detail replace: hard-delete lama + insert baru (parity SP) */
  public async replaceDetailAddInfos(
    detailId: string,
    rows: Array<{ name?: string; value?: string }>,
    userBy: string,
    transaction?: Transaction,
  ): Promise<void> {
    await PlanOutgoingDetailAddInfo.destroy({
      where: { planOutgoingDetailId: detailId },
      transaction,
    });
    const now = nowWib();
    for (const row of filterAddInfos(rows)) {
      await PlanOutgoingDetailAddInfo.create(
        {
          planOutgoingDetailId: detailId,
          name: row.name,
          value: row.value,
          createdDate: now,
          createdBy: userBy,
        },
        { transaction },
      );
    }
  }
}
