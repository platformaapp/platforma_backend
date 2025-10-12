import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '../entities/booking.entity';

export class BookingResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  slotId: string;

  @ApiProperty()
  tutorId: string;

  @ApiProperty()
  studentId: string;

  @ApiProperty({ enum: BookingStatus })
  status: BookingStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: () => Object, required: false })
  slot?: {
    id: string;
    date: string;
    time: string;
    tutor: {
      id: string;
      fullName: string;
      email: string;
    };
  };

  @ApiProperty({ type: () => Object, required: false })
  student?: {
    id: string;
    fullName: string;
    email: string;
  };

  @ApiProperty({ type: () => Object, required: false })
  tutor?: {
    id: string;
    fullName: string;
    email: string;
  };
}
