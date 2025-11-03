import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'ID сессии для оплаты',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  sessionId: string;

  @ApiProperty({
    description: 'ID платежного метода (карты)',
    example: 'ca47492c-76d9-4e0a-a08f-f918a803a0fb',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  paymentMethodId?: string;
}
