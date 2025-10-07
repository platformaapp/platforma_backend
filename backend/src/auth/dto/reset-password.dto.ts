import { IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty()
  @IsNotEmpty()
  reset_token: string;

  @ApiProperty()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
