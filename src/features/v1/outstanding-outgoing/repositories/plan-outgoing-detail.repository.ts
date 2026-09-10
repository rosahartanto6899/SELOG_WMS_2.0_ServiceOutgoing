import { injectable } from 'inversify';
import { Op, Transaction } from 'sequelize';
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

  /** A2 — semua detail satu header (stok balik per material) */
  public async findByHeader(headerId: string, transaction?: Transaction) {
    return PlanOutgoingDetail.findAll({
      where: { planOutgoingHeaderId: headerId },
      transaction,
    });
  }

  /** A8 — bulk fetch by ids */
  public async findByIds(ids: string[], transaction?: Transaction) {
    return PlanOutgoingDetail.findAll({
      where: { id: { [Op.in]: ids } },
      transaction,
    });
  }

  /** A9 sample — detail by satu packagingNo */
  public async findByPackagingNo(packagingNo: string, transaction?: Transaction) {
    return PlanOutgoingDetail.findAll({
      where: { packagingNo },
      transaction,
    });
  }

  /** A9 — detail by beberapa packagingNo */
  public async findByPackagingNos(
    packagingNos: string[],
    transaction?: Transaction,
  ) {
    return PlanOutgoingDetail.findAll({
      where: { packagingNo: { [Op.in]: packagingNos } },
      transaction,
    });
  }

  /** A9 — semua detail beberapa header (cek shipment penuh) */
  public async findByHeaders(headerIds: string[], transaction?: Transaction) {
    return PlanOutgoingDetail.findAll({
      where: { planOutgoingHeaderId: { [Op.in]: headerIds } },
      transaction,
    });
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
