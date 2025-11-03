import { ApiProperty } from '@nestjs/swagger';

export class SetDefaultPaymentMethodResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty()
  paymentMethodId: string;

  @ApiProperty()
  isDefault: boolean;
}
