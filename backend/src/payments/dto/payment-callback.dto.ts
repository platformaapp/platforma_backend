import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentCallbackDto {
  @ApiPropertyOptional({ description: 'ID платежа из YooKassa' })
  payment_id?: string;

  @ApiPropertyOptional({ description: 'ID способа оплаты (для привязки карты)' })
  method_id?: string;
}
