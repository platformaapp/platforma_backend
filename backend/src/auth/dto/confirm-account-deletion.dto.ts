import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmAccountDeletionDto {
  @ApiProperty()
  @IsNotEmpty()
  token: string;
}
