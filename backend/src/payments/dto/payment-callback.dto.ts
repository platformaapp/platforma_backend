import { ApiProperty } from '@nestjs/swagger';

export class PaymentCallbackDto {
  @ApiProperty({ description: 'ID платежа из YooKassa' })
  payment_id: string;
}
