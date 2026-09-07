import { injectable } from 'inversify';
import { Transaction } from 'sequelize';
import {
  PlanOutgoingHeader,
  PlanOutgoingHeaderAddInfo,
  PlanOutgoingDetail,
  PlanOutgoingDetailAddInfo,
} from '@/database/entities';
import { PlanOutgoingHeaderAttributes } from '@/database/attributes';
import { nowWib } from '@/utils';
import { filterAddInfos } from '../constants';

/** Header CRUD + add-info replace (C1/C3/C6) */
@injectable()
export class OutstandingOutgoingRepository {
  public async getById(id: string, transaction?: Transaction) {
    return PlanOutgoingHeader.findByPk(id, { transaction });
  }

  public async getByDeliveryNoteNo(
    deliveryNoteNo: string,
    transaction?: Transaction,
    lock = false,
  ) {
    // parity SP incoming: EXISTS semua header dengan DN sama (termasuk soft-deleted)
    return PlanOutgoingHeader.findOne({
      where: { deliveryNoteNo },
      transaction,
      ...(lock && transaction ? { lock } : {}),
    });
  }

  /** C6 — header + details (+add-info masing-masing) */
  public async findDetailById(id: string) {
    return PlanOutgoingHeader.findOne({
      where: { id },
      include: [
        {
          model: PlanOutgoingDetail,
          as: 'details',
          include: [
            { model: PlanOutgoingDetailAddInfo, as: 'addInfos', separate: true },
          ],
        },
        { model: PlanOutgoingHeaderAddInfo, as: 'addInfos', separate: true },
      ],
    });
  }

  public async createHeader(
    data: PlanOutgoingHeaderAttributes,
    transaction?: Transaction,
  ) {
    return PlanOutgoingHeader.create(data, { transaction });
  }

  public async updateHeader(
    id: string,
    data: Partial<PlanOutgoingHeaderAttributes>,
    transaction?: Transaction,
  ) {
    await PlanOutgoingHeader.update(data, { where: { id }, transaction });
  }

  /** Add-info header replace: hard-delete lama + insert baru (parity SP) */
  public async replaceHeaderAddInfos(
    headerId: string,
    rows: Array<{ name?: string; value?: string }>,
    userBy: string,
    transaction?: Transaction,
  ): Promise<void> {
    await PlanOutgoingHeaderAddInfo.destroy({
      where: { planOutgoingHeaderId: headerId },
      transaction,
    });
    const now = nowWib();
    for (const row of filterAddInfos(rows)) {
      await PlanOutgoingHeaderAddInfo.create(
        {
          planOutgoingHeaderId: headerId,
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
