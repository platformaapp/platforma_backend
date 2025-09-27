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
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventStatusDto } from './dto/update-eventStatus.dto';
import type { AuthenticatedRequest } from 'src/utils/types';

@Controller('tutor')
export class TutorController {
  constructor(private readonly tutorService: TutorService) {}

  @Get('profile')
  @UseGuards(TutorGuard)
  getProfile(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    return this.tutorService.getTutorProfile(userId);
  }

  @Put('profile')
  @HttpCode(HttpStatus.OK)
  @UseGuards(TutorGuard)
  updateProfile(@Req() req: AuthenticatedRequest, @Body() updateProfileDto: UpdateProfileDto) {
    const userId = req.user.sub;
    return this.tutorService.updateTutorProfile(userId, updateProfileDto);
  }

  //Slots

  @Get('slots')
  @UseGuards(TutorGuard)
  getSlots(@Req() req: AuthenticatedRequest, @Query() filterDto: GetSlotsFilterDto) {
    const userId = req.user.sub;
    return this.tutorService.getTutorSlots(userId, filterDto);
  }

  @Post('slots')
  @UseGuards(TutorGuard)
  createSlot(@Req() req: AuthenticatedRequest, @Body() createSlotDto: CreateSlotDto) {
    const userId = req.user.sub;
    return this.tutorService.createSlot(userId, createSlotDto);
  }

  @Put('slots/:id')
  @UseGuards(TutorGuard)
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
  @Get('events')
  @UseGuards(TutorGuard)
  getEvents(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    return this.tutorService.getTutorEvents(userId);
  }

  @Post('events')
  @UseGuards(TutorGuard)
  async createEvent(@Req() req: AuthenticatedRequest, @Body() createEventDto: CreateEventDto) {
    const userId = req.user.sub;
    return this.tutorService.createEvent(userId, createEventDto);
  }

  @Put('events/:id')
  @UseGuards(TutorGuard)
  async updateEventStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') eventId: string,
    @Body() updateEventStatusDto: UpdateEventStatusDto
  ) {
    const userId = req.user.sub;
    return this.tutorService.updateEventStatus(userId, eventId, updateEventStatusDto.status);
  }

  @Get('payments')
  @UseGuards(TutorGuard)
  async getPayments(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    return this.tutorService.getTutorPayments(userId);
  }

  @Get('payments/summary')
  @UseGuards(TutorGuard)
  async getPaymentsSummary(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    return this.tutorService.getPaymentsSummary(userId);
  }
}
