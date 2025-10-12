import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Param,
  Delete,
} from '@nestjs/common';
import { StudentService } from './student.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudentGuard } from '../auth/guards/student.guard';
import type { AuthenticatedRequest, BookingDetails } from '../utils/types';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Student')
@ApiBearerAuth('JWT-auth')
@Controller('student')
@UseGuards(JwtAuthGuard, StudentGuard)
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Post('bookings')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a booking' })
  @ApiBody({ type: CreateBookingDto })
  @ApiResponse({
    status: 201,
    description: 'Booking successfully created',
  })
  async createBooking(
    @Req() req: AuthenticatedRequest,
    @Body() createBookingDto: CreateBookingDto
  ): Promise<BookingDetails> {
    const studentId = req.user.sub;
    return this.studentService.createBooking(studentId, createBookingDto.slotId);
  }

  @Get('bookings')
  @ApiOperation({ summary: 'Get bookings' })
  @ApiResponse({
    status: 200,
    description: 'The list of bookings has been successfully received',
  })
  async getMyBookings(@Req() req: AuthenticatedRequest): Promise<BookingDetails[]> {
    const studentId = req.user.sub;
    return this.studentService.getStudentBookings(studentId);
  }

  @Delete('bookings/:id')
  @ApiOperation({ summary: 'Cancel booking' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'Booking successfully cancelled',
    schema: {
      example: {
        id: '4174ads00d0',
        slotId: '12o3e456a8266',
        tutorId: '614174002',
        studentId: '1234003',
        status: 'cancelled',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Booking not found',
  })
  async cancelBooking(
    @Req() req: AuthenticatedRequest,
    @Param('id') bookingId: string
  ): Promise<BookingDetails> {
    const studentId = req.user.sub;
    return this.studentService.cancelBooking(studentId, bookingId);
  }
}
