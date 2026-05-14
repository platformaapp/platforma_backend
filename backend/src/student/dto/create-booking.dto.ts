import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({
    description: 'Slot ID for booking',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  slotId: string;

  @ApiProperty({
    description: 'Payment method ID (saved card). If omitted, YooKassa redirect form is used.',
    example: 'ca47492c-76d9-4e0a-a08f-f918a803a0fb',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  payment_method_id?: string;
}
