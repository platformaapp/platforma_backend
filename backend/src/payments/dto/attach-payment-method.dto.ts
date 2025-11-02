import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaymentProvider } from '../entities/payment-method.entity';

export class AttachPaymentMethodDto {
  @ApiProperty({
    enum: PaymentProvider,
    default: PaymentProvider.YOOKASSA,
    description: 'Платежный провайдер',
  })
  @IsEnum(PaymentProvider)
  @IsOptional()
  provider?: PaymentProvider;
}
