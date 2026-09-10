export interface PlanOutgoingHeaderAttributes {
  id?: string;
  customerCode: string;
  customerName: string;
  warehouseCode: string;
  warehouseName: string;
  deliveryNoteNo: string;
  outgoingDate?: Date | string | null;
  poNo: string;
  poType?: string | null;
  poDate?: Date | string | null;
  customerDestination?: string | null;
  referenceNo?: string | null;
  materialCategory?: string;
  description?: string | null;
  status?: string;
  picPicker?: string | null;
  picLoading?: string | null;
  isHold?: boolean;
  isActive?: boolean;
  createdDate?: Date;
  createdBy?: string | null;
  modifiedDate?: Date | null;
  modifiedBy?: string | null;
  deletedBy?: string | null;
  deletedDate?: Date | null;
}

export interface PlanOutgoingDetailAttributes {
  id?: string;
  planOutgoingHeaderId: string;
  materialCode: string;
  materialName: string;
  materialBrand: string;
  materialBarcode?: string | null;
  materialLocationBarcode?: string | null;
  uom: string;
  poQty: number;
  pickingQty?: number | null;
  pickingDate?: Date | null;
  description?: string | null;
  packagingNo?: string | null;
  createdDate?: Date;
  createdBy?: string | null;
  modifiedDate?: Date | null;
  modifiedBy?: string | null;
  deletedBy?: string | null;
  deletedDate?: Date | null;
}

export interface PlanOutgoingHeaderAddInfoAttributes {
  id?: string;
  planOutgoingHeaderId?: string | null;
  name?: string | null;
  value?: string | null;
  createdDate?: Date;
  createdBy?: string | null;
  modifiedDate?: Date | null;
  modifiedBy?: string | null;
  deletedBy?: string | null;
  deletedDate?: Date | null;
}

export interface PlanOutgoingDetailAddInfoAttributes {
  id?: string;
  planOutgoingDetailId?: string | null;
  name?: string | null;
  value?: string | null;
  createdDate?: Date;
  createdBy?: string | null;
  modifiedDate?: Date | null;
  modifiedBy?: string | null;
  deletedBy?: string | null;
  deletedDate?: Date | null;
}

export interface PlanOutgoingPackagingAttributes {
  id?: string;
  packagingNo?: string | null;
  shipmentNo?: string | null;
  customerDestination?: string | null;
  materialCode?: string | null;
  materialName?: string | null;
  materialBrand?: string | null;
  qty?: number | null;
  uom?: string | null;
  weight?: number;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  isActive?: boolean | null;
  createdDate?: Date | null;
  createdBy?: string | null;
  modifiedDate?: Date | null;
  modifiedBy?: string | null;
  deletedBy?: string | null;
  deletedDate?: Date | null;
}

export interface PlanOutgoingHistoryAttributes {
  id?: string;
  planOutgoingHeaderId?: string | null;
  status?: string | null;
  date?: Date | null;
  leadtime?: number | null;
  pic?: string | null;
  createdDate?: Date | null;
  createdBy?: string | null;
}
