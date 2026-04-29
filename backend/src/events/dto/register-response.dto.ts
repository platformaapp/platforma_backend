export class RegisterResponseDto {
  success: boolean;
  message: string;
  userEvent?: {
    id: string;
    status: string;
    payment_status: string;
    created_at: string;
  };
  /** Present only for paid events. If set, redirect the user here for 3DS confirmation. */
  confirmation_url?: string;
  /** True when event.price > 0 and payment was initiated (or already paid). */
  payment_required?: boolean;
  /** YooKassa payment ID — pass as ?yookassa_payment_id= to the status-sync endpoint when polling. */
  yookassa_payment_id?: string;
  /** Set when payment creation failed. User should retry via POST /student/payments/event/:id */
  payment_error?: string;
}
