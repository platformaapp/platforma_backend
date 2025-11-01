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
    authorization_details?: {
      rrn: string;
      auth_code: string;
    };
    payment_method?: {
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
    metadata?: Record<string, any>;
  };
}
