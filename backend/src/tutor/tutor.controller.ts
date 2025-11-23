import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TutorService } from './tutor.service';
import { TutorGuard } from 'src/auth/guards/tutor.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { GetSlotsFilterDto } from './dto/get-slots-filter.dto';
import { CreateSlotDto } from './dto/create-slot.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';
import type { AuthenticatedRequest, BookingDetails } from 'src/utils/types';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Tutor')
@ApiBearerAuth('JWT-auth')
@Controller('tutor')
export class TutorController {
  constructor(private readonly tutorService: TutorService) {}

  @Get('profile')
  @UseGuards(TutorGuard)
  @ApiOperation({ summary: 'Get tutor profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tutor profile retrieved successfully',
  })
  getProfile(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    return this.tutorService.getTutorProfile(userId);
  }

  @Put('profile')
  @HttpCode(HttpStatus.OK)
  @UseGuards(TutorGuard)
  @ApiOperation({ summary: 'Update tutor profile' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile updated successfully',
  })
  updateProfile(@Req() req: AuthenticatedRequest, @Body() updateProfileDto: UpdateProfileDto) {
    const userId = req.user.sub;
    return this.tutorService.updateTutorProfile(userId, updateProfileDto);
  }

  //Slots

  @Get('slots')
  @UseGuards(TutorGuard)
  @ApiOperation({ summary: 'Get tutor slots' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Slots retrieved successfully',
  })
  getSlots(@Req() req: AuthenticatedRequest, @Query() filterDto: GetSlotsFilterDto) {
    const userId = req.user.sub;
    return this.tutorService.getTutorSlots(userId, filterDto);
  }

  @Post('slots')
  @UseGuards(TutorGuard)
  @ApiOperation({ summary: 'Create slot' })
  @ApiBody({ type: CreateSlotDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Slot created successfully',
  })
  createSlot(@Req() req: AuthenticatedRequest, @Body() createSlotDto: CreateSlotDto) {
    const userId = req.user.sub;
    return this.tutorService.createSlot(userId, createSlotDto);
  }

  @Put('slots/:id')
  @UseGuards(TutorGuard)
  @ApiOperation({ summary: 'Update slot' })
  @ApiParam({ name: 'id', description: 'Slot ID' })
  @ApiBody({ type: UpdateSlotDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Slot updated successfully',
  })
  updateSlot(
    @Req() req: AuthenticatedRequest,
    @Param('id') slotId: string,
    @Body() updateSlotDto: UpdateSlotDto
  ) {
    const userId = req.user.sub;
    return this.tutorService.updateSlot(userId, slotId, updateSlotDto);
  }

  @Delete('slots/:id')
  @UseGuards(TutorGuard)
  @ApiOperation({ summary: 'Delete slot' })
  @ApiParam({ name: 'id', description: 'Slot ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Slot deleted successfully',
    schema: {
      example: {
        message: 'Slot deleted successfully',
      },
    },
  })
  async deleteSlot(
    @Req() req: AuthenticatedRequest,
    @Param('id') slotId: string
  ): Promise<{ message: string }> {
    const userId = req.user.sub;
    await this.tutorService.deleteSlot(userId, slotId);
    return { message: 'Slot deleted successfully' };
  }

  // Bulk delete
  @Delete('slots')
  @UseGuards(TutorGuard)
  @ApiOperation({ summary: 'Delete multiple slots' })
  @ApiBody({
    schema: {
      example: {
        slotIds: ['uuid1', 'uuid2', 'uuid3'],
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Slots deleted successfully',
    schema: {
      example: {
        message: 'Slots deleted successfully',
        deletedCount: 3,
      },
    },
  })
  async deleteSlots(
    @Req() req: AuthenticatedRequest,
    @Body() body: { slotIds: string[] }
  ): Promise<{ message: string; deletedCount: number }> {
    const userId = req.user.sub;
    const result = await this.tutorService.deleteSlots(userId, body.slotIds);
    return {
      message: 'Slots deleted successfully',
      deletedCount: result.deletedCount,
    };
  }

  //Events
  // @Get('events')
  // @UseGuards(TutorGuard)
  // @ApiOperation({ summary: 'Get tutor events' })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Events retrieved successfully',
  // })
  // getEvents(@Req() req: AuthenticatedRequest) {
  //   const userId = req.user.sub;
  //   return this.tutorService.getTutorEvents(userId);
  // }
  //
  // @Post('events')
  // @UseGuards(TutorGuard)
  // @ApiOperation({ summary: 'Create event' })
  // @ApiBody({ type: CreateEventDto })
  // @ApiResponse({
  //   status: 201,
  //   description: 'Event created successfully',
  // })
  // async createEvent(@Req() req: AuthenticatedRequest, @Body() createEventDto: CreateEventDto) {
  //   const userId = req.user.sub;
  //   return this.tutorService.createEvent(userId, createEventDto);
  // }
  //
  // @Put('events/:id')
  // @UseGuards(TutorGuard)
  // @ApiOperation({ summary: 'Update event status' })
  // @ApiParam({ name: 'id', description: 'Event ID' })
  // @ApiBody({ type: UpdateEventStatusDto })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Event status updated successfully',
  // })
  // async updateEventStatus(
  //   @Req() req: AuthenticatedRequest,
  //   @Param('id') eventId: string,
  //   @Body() updateEventStatusDto: UpdateEventStatusDto
  // ) {
  //   const userId = req.user.sub;
  //   return this.tutorService.updateEventStatus(userId, eventId, updateEventStatusDto.status);
  // }

  @Get('payments')
  @UseGuards(TutorGuard)
  @ApiOperation({ summary: 'Get tutor payments' })
  @ApiResponse({
    status: 200,
    description: 'Payments retrieved successfully',
  })
  async getPayments(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    return this.tutorService.getTutorPayments(userId);
  }

  @Get('payments/summary')
  @UseGuards(TutorGuard)
  @ApiOperation({ summary: 'Get payments summary' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payments summary retrieved successfully',
  })
  async getPaymentsSummary(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    return this.tutorService.getPaymentsSummary(userId);
  }

  @Get('bookings')
  @UseGuards(TutorGuard)
  @ApiOperation({ summary: 'Get bookings as a tutor' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Booking list got successfully',
  })
  async getMyBookings(@Req() req: AuthenticatedRequest): Promise<BookingDetails[]> {
    const tutorId = req.user.sub;
    return this.tutorService.getTutorBookings(tutorId);
  }

  @Put('bookings/:id/complete')
  @UseGuards(TutorGuard)
  @ApiOperation({ summary: 'End of session' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The session ended successfully',
    example: {
      id: '123e45u67',
      slotId: '98qee4dq3',
      tutorId: 'ew83e4562',
      studentId: '4q17e400p',
      status: 'done',
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No bookings found',
  })
  async completeBooking(
    @Req() req: AuthenticatedRequest,
    @Param('id') bookingId: string
  ): Promise<BookingDetails> {
    const tutorId = req.user.sub;
    return this.tutorService.completeBooking(tutorId, bookingId);
  }
}
