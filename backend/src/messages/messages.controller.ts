import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../utils/types';

@ApiTags('Messages')
@ApiBearerAuth('JWT-auth')
@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List conversations for the current user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Conversations retrieved successfully' })
  getConversations(@Req() req: AuthenticatedRequest) {
    return this.messagesService.getConversations(req.user.sub);
  }

  @Get('with/:userId')
  @ApiOperation({ summary: 'Get message thread with a specific user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Thread retrieved successfully' })
  getThread(
    @Req() req: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page = 1,
    @Query('per_page') perPage = 50
  ) {
    return this.messagesService.getThread(req.user.sub, userId, Number(page), Number(perPage));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a message' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Message sent successfully' })
  sendMessage(@Req() req: AuthenticatedRequest, @Body() dto: CreateMessageDto) {
    return this.messagesService.sendMessage(req.user.sub, dto);
  }
}
