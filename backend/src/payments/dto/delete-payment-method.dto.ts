import { ApiProperty } from '@nestjs/swagger';

export class DeletePaymentMethodResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  defaultPaymentMethodUpdated?: boolean;
}
