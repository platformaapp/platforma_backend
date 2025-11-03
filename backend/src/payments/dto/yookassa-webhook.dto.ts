import { ApiProperty } from '@nestjs/swagger';

export class YookassaWebhookDto {
  @ApiProperty()
  type: string;

  @ApiProperty()
  event: string;

  @ApiProperty()
  object: {
    id: string;
    status: string;
    paid: boolean;
    amount: {
      value: string;
      currency: string;
    };
    income_amount?: {
      value: string;
      currency: string;
    };
    payment_method: {
      id: string;
      saved: boolean;
      type: string;
      card?: {
        first6: string;
        last4: string;
        expiry_month: string;
        expiry_year: string;
        card_type: string;
      };
    };
    captured_at?: string;
    created_at: string;
    expires_at?: string;
    description?: string;
    metadata?: {
      payment_id?: string;
      type?: string;
      [key: string]: any;
    };
    recipient: {
      account_id: string;
      gateway_id: string;
    };
    refundable: boolean;
    test: boolean;
  };
}
