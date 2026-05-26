import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Param,
  Delete,
} from '@nestjs/common';
import { StudentService } from './student.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
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

  @Get('profile')
  @ApiOperation({ summary: 'Get student profile' })
  @ApiResponse({ status: 200, description: 'Student profile retrieved successfully' })
  async getProfile(@Req() req: AuthenticatedRequest) {
    return this.studentService.getStudentProfile(req.user.sub);
  }

  @Put('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update student profile' })
  @ApiBody({ type: UpdateStudentProfileDto })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 409, description: 'Email or phone already in use' })
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateStudentProfileDto
  ) {
    return this.studentService.updateStudentProfile(req.user.sub, dto);
  }

  @Get('tutors/:tutorId/slots')
  @ApiOperation({ summary: 'Get slots for a tutor (all future slots)' })
  @ApiParam({ name: 'tutorId', description: 'Tutor user ID' })
  @ApiResponse({
    status: 200,
    description: 'Slots retrieved successfully',
    schema: {
      example: [
        { id: 'uuid', date: '2025-05-20', time: '14:00', status: 'free', price: 1500 },
      ],
    },
  })
  @ApiResponse({ status: 404, description: 'Tutor not found' })
  async getTutorSlots(@Param('tutorId') tutorId: string) {
    return this.studentService.getTutorAvailableSlots(tutorId);
  }

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
    return this.studentService.createBooking(
      studentId,
      createBookingDto.slotId,
      createBookingDto.payment_method_id
    );
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

  @Get('bookings/:id/join')
  @ApiOperation({ summary: 'Get Jitsi join URL for a personal meeting' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'Join URL returned',
    schema: { example: { join_url: 'https://jitsi.platformaapp.ru/platforma-abc123' } },
  })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async getBookingJoinUrl(
    @Req() req: AuthenticatedRequest,
    @Param('id') bookingId: string
  ): Promise<{ join_url: string }> {
    return this.studentService.getBookingJoinUrl(req.user.sub, bookingId);
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
