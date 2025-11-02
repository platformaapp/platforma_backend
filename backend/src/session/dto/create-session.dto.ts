import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsNumber, IsPositive, IsString, IsUUID } from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({
    description: 'ID of the tutor',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  tutorId: string;

  @ApiProperty({
    description: 'ID of the student',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  studentId: string;

  @ApiProperty({
    description: 'Session start time in ISO format',
    example: '2024-01-15T10:00:00.000Z',
  })
  @IsNotEmpty()
  @IsDateString()
  startTime: Date;

  @ApiProperty({
    description: 'Session end time in ISO format',
    example: '2024-01-15T11:00:00.000Z',
  })
  @IsNotEmpty()
  @IsDateString()
  endTime: Date;

  @ApiProperty({
    description: 'Session price',
    example: 2500,
    minimum: 0,
  })
  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  price: number;
}
