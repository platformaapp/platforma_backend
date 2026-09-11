import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateMessageDto {
  @IsUUID()
  receiver_id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  text: string;
}
