import { inject, injectable } from 'inversify';
import { HTTP_STATUS } from '@/shared-libs/constants/http-status.constant';
import { NotFoundException } from '@/shared-libs/exceptions';
import { OutstandingOutgoingRepository } from './repositories';
import { ByIdTransform } from './transforms';

/** Query read — C6 data form edit */
@injectable()
export class QueryService {
  constructor(
    @inject(OutstandingOutgoingRepository)
    private readonly repository: OutstandingOutgoingRepository,
  ) {}

  /** C6 GET /:id/edit — data form edit + flag bisa-edit per detail */
  async getEdit(id: string) {
    const header = await this.repository.findDetailById(id);
    if (!header) {
      throw new NotFoundException('Plan outgoing not found');
    }
    const plain = header.get({ plain: true }) as any;
    return {
      data: {
        ...new ByIdTransform().transform(plain),
        details: (plain.details ?? []).map((d: any) => ({
          ...new ByIdTransform().transformDetail(d),
          canEdit: d.pickingDate == null, // flag bisa-edit per detail
        })),
      },
      httpCode: HTTP_STATUS.OK,
    };
  }
}
