import {
  SendReminderApprovalBookingPublisher,
  SendNeedConfirmPairingPublisher,
  SendPairingMatchingConfirmationPublisher,
  SendOrderPairingRevisionPublisher,
  InsertJourneyActivityHistoriesPublisher,
  UpdateVehicleCapacityStatusPublisher,
  InsertShipmentExpensePublisher,
  InsertPODActivityHistoryPublisher,
  InsertExpenseActivityHistoryPublisher,
  InsertShipmentDriverActivityPublisher,
  TriggerTermin1Publisher,
  UpdateDriverCapacityStatusPublisher,
  SendShipmentCancellationRequestPublisher,
  SendDriverNotificationRerouteReschedulePublisher,
  SendDriverNotificationCancelPublisher,
  SendOtpPublisher,
  SendDriverMedicalResultNotificationPublisher,
  SendPendingShipmentPublisher,
  SendNotificationCustomerOrderPublisher,
} from './handlers';

/**
 * Interface for publisher registration
 */
export interface IPublisherRegistration {
  publisherClass: any;
  config: {
    enabled: boolean;
    autoInitialize?: boolean;
  };
}

/**
 * Configuration array for registering service bus publishers.
 *
 * Each entry specifies the publisher class and its associated configuration,
 * including enabled status and auto-initialization flag.
 *
 * Publishers registered here can be injected into services and used to publish messages.
 *
 * @remarks
 * Extend this array to add more publisher configurations as needed.
 *
 * @see IPublisherRegistration
 */
export const SERVICE_BUS_PUBLISHER_CONFIG: IPublisherRegistration[] = [
  {
    publisherClass: SendReminderApprovalBookingPublisher,
    config: {
      enabled: true,
      autoInitialize: true,
    },
  },
  {
    publisherClass: SendNeedConfirmPairingPublisher,
    config: {
      enabled: true,
      autoInitialize: true,
    },
  },
  {
    publisherClass: SendPairingMatchingConfirmationPublisher,
    config: {
      enabled: true,
      autoInitialize: true,
    },
  },
  {
    publisherClass: SendOrderPairingRevisionPublisher,
    config: {
      enabled: true,
      autoInitialize: true,
    },
  },
  {
    publisherClass: InsertJourneyActivityHistoriesPublisher,
    config: {
      enabled: true,
      autoInitialize: true,
    },
  },
  {
    publisherClass: UpdateVehicleCapacityStatusPublisher,
    config: {
      enabled: true,
      autoInitialize: true,
    },
  },
  {
    publisherClass: InsertShipmentExpensePublisher,
    config: {
      enabled: true,
      autoInitialize: true,
    },
  },
  {
    publisherClass: InsertPODActivityHistoryPublisher,
    config: {
      enabled: true,
      autoInitialize: true,
    },
  },
  {
    publisherClass: InsertExpenseActivityHistoryPublisher,
    config: {
      enabled: true,
      autoInitialize: true,
    },
  },
  {
    publisherClass: InsertShipmentDriverActivityPublisher,
    config: {
      enabled: true,
      autoInitialize: true,
    },
  },
  {
    publisherClass: TriggerTermin1Publisher,
    config: {
      enabled: true,
      autoInitialize: true,
    },
  },
  {
    publisherClass: UpdateDriverCapacityStatusPublisher,
    config: {
      enabled: true,
      autoInitialize: true,
    },
  },
  {
    publisherClass: SendShipmentCancellationRequestPublisher,
    config: {
      enabled: true,
      autoInitialize: true,
    },
  },
  {
    publisherClass: SendDriverNotificationRerouteReschedulePublisher,
    config: {
      enabled: true,
      autoInitialize: true,
    },
  },
  {
    publisherClass: SendDriverNotificationCancelPublisher,
    config: {
      enabled: true,
      autoInitialize: true,
    },
  },
  {
    publisherClass: SendOtpPublisher,
    config: {
      enabled: true,
      autoInitialize: true,
    },
  },
  {
    publisherClass: SendDriverMedicalResultNotificationPublisher,
    config: {
      enabled: true,
      autoInitialize: true,
    },
  },
  {
    publisherClass: SendNotificationCustomerOrderPublisher,
    config: {
      enabled: true,
      autoInitialize: true,
    },
  },
  {
    publisherClass: SendPendingShipmentPublisher,
    config: {
      enabled: true,
      autoInitialize: true,
    },
  },
];
