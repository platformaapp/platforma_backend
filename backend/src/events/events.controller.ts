import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  Req,
  Patch,
  Param,
  ParseUUIDPipe,
  Delete,
  Get,
  Query,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateEventDto } from './dto/create-event.dto';
import { EventResponseDto } from './dto/event-response.dto';
import type { AuthenticatedRequest } from '../utils/types';
import { toEventResponseDto } from '../utils/helper';
import { UpdateEventDto } from './dto/update-event.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { EventDetailResponseDto } from './dto/event-detail-response.dto';
import { CountdownResponseDto } from './dto/countdown-response.dto';
import { CreateVideoRoomDto, VideoRoomResponseDto } from './dto/create-video-room.dto';
import { EventsFeedQueryDto } from './dto/events-feed-query.dto';
import { EventsFeedResponseDto } from './dto/events-feed-response.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createEventDto: CreateEventDto,
    @Req() req: AuthenticatedRequest
  ): Promise<EventResponseDto> {
    const event = await this.eventsService.createEvent(createEventDto, req.user.sub);
    return toEventResponseDto(event);
  }

  @Get('feed')
  async getEventsFeed(
    @Query() query: EventsFeedQueryDto,
    @Req() req?: AuthenticatedRequest
  ): Promise<EventsFeedResponseDto> {
    const userId = req?.user?.sub;
    return await this.eventsService.getEventsFeed(query, userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEventDto: UpdateEventDto,
    @Req() req: AuthenticatedRequest
  ): Promise<EventResponseDto> {
    const event = await this.eventsService.updateEvent(id, updateEventDto, req.user.sub);
    return toEventResponseDto(event);
  }

  @Post(':id/register')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest
  ): Promise<RegisterResponseDto> {
    const userEvent = await this.eventsService.registerForEvent(id, req.user.sub);

    return {
      success: true,
      message: 'Вы успешно записались на событие',
      userEvent: {
        id: userEvent.id,
        status: userEvent.status,
        payment_status: userEvent.paymentStatus,
        created_at: userEvent.createdAt.toISOString(),
      },
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest
  ): Promise<{ success: boolean; message: string }> {
    await this.eventsService.deleteEvent(id, req.user.sub);

    return {
      success: true,
      message: 'Событие успешно удалено',
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<EventDetailResponseDto> {
    return await this.eventsService.getEventDetails(id);
  }

  @Get(':id/countdown')
  @UseGuards(JwtAuthGuard)
  async getCountdown(@Param('id', ParseUUIDPipe) id: string): Promise<CountdownResponseDto> {
    return await this.eventsService.getEventCountdown(id);
  }

  @Get(':id/join')
  @UseGuards(JwtAuthGuard)
  async joinEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest
  ): Promise<{ join_url: string }> {
    return await this.eventsService.getEventJoinUrl(id, req.user.sub);
  }

  @Post('video_rooms/create')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createVideoRoom(
    @Body() createVideoRoomDto: CreateVideoRoomDto,
    @Req() req: AuthenticatedRequest
  ): Promise<VideoRoomResponseDto> {
    return await this.eventsService.createVideoRoom(createVideoRoomDto, req.user.sub);
  }
}
