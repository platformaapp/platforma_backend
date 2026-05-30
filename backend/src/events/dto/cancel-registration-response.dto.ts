export class CancelRegistrationResponseDto {
  success: boolean;
  message: string;
  cancelled_at: string;
  refunded: boolean;
  refund_id?: string;
  /** Populated when paid and cancelled < 24h before — explains why no refund. */
  no_refund_reason?: string;
}
