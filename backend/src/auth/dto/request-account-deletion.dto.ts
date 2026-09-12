import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestAccountDeletionDto {
  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
