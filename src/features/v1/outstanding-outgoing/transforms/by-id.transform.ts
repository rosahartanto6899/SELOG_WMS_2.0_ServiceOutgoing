import { DateHelper } from '@/shared-libs/helpers/date.helper';

/** Map C6 — header + details + addInfos (delta outgoing: outgoingDate,
 *  customerDestination, pickingQty/pickingDate; canEdit = pickingDate == null) */
export class ByIdTransform {
  transformDetail(detail: any): any {
    return {
      id: detail.id,
      materialCode: detail.materialCode,
      materialName: detail.materialName,
      materialBrand: detail.materialBrand,
      materialBarcode: detail.materialBarcode ?? null,
      materialLocationBarcode: detail.materialLocationBarcode ?? null,
      uom: detail.uom,
      poQty: detail.poQty,
      pickingQty: detail.pickingQty ?? 0,
      pickingDate: detail.pickingDate
        ? DateHelper.formatDefault(detail.pickingDate)
        : null,
      packagingNo: detail.packagingNo ?? null,
      shipmentNo: detail.packaging?.shipmentNo ?? null,
      description: detail.description ?? null,
      addInfos: (detail.addInfos ?? []).map((a: any) => ({
        name: a.name,
        value: a.value,
      })),
    };
  }

  transform(header: any): any {
    return {
      id: header.id,
      customerCode: header.customerCode,
      customerName: header.customerName,
      warehouseCode: header.warehouseCode,
      warehouseName: header.warehouseName,
      deliveryNoteNo: header.deliveryNoteNo,
      poNo: header.poNo,
      poType: header.poType ?? null,
      poDate: header.poDate ? DateHelper.formatDefault(header.poDate) : null,
      outgoingDate: header.outgoingDate
        ? DateHelper.formatDefault(header.outgoingDate)
        : null,
      customerDestination: header.customerDestination ?? null,
      referenceNo: header.referenceNo ?? null,
      materialCategory: header.materialCategory ?? null,
      description: header.description ?? null,
      status: header.status,
      isHold: header.isHold ? 1 : 0,
      createdAt: header.createdDate
        ? DateHelper.formatDefault(header.createdDate)
        : null,
      createdBy: header.createdBy ?? null,
      addInfos: (header.addInfos ?? []).map((a: any) => ({
        name: a.name,
        value: a.value,
      })),
    };
  }
}
