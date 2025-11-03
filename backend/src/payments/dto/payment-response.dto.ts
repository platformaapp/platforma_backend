import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '../entities/payment.entity';

export class PaymentResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty()
  paymentId: string;

  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;

  @ApiProperty({ required: false })
  redirectUrl?: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  currency: string;
}
