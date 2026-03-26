import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Param,
  Logger,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import type { AuthenticatedRequest } from '../utils/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudentGuard } from '../auth/guards/student.guard';
import { PaymentStatus } from './entities/payment.entity';
import { PaymentCallbackDto } from './dto/payment-callback.dto';

@ApiTags('Student Payments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, StudentGuard)
@Controller('student/payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get student payment history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Payment history retrieved successfully' })
  async getPayments(
    @Req() req: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number
  ) {
    const result = await this.paymentsService.getStudentPayments(req.user.sub, page, limit);
    return {
      success: true,
      data: result.data.map((p) => ({
        id: p.id,
        kind: p.kind,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt,
        paidAt: p.paidAt,
        sessionId: p.sessionId,
        eventId: p.eventId,
        eventTitle: p.eventTitle,
        tutorName: p.counterpartyName,
        counterpartyName: p.counterpartyName,
        errorMessage: p.errorMessage || null,
      })),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        hasNext: page * limit < result.total,
      },
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create payment for session' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Payment created successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request or session already paid',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Session or payment method not found' })
  async createPayment(
    @Req() req: AuthenticatedRequest,
    @Body() createPaymentDto: CreatePaymentDto
  ): Promise<PaymentResponseDto> {
    this.logger.log(
      `User ${req.user.sub} creating payment for session ${createPaymentDto.sessionId}`
    );

    const result = await this.paymentsService.createSessionPayment(
      req.user.sub,
      createPaymentDto.sessionId,
      createPaymentDto.paymentMethodId
    );

    return {
      success: true,
      message:
        result.status === PaymentStatus.SUCCESS
          ? 'Payment completed successfully'
          : 'Payment initiated successfully',
      paymentId: result.paymentId,
      status: result.status,
      redirectUrl: result.redirectUrl,
      amount: result.amount,
      currency: result.currency,
    };
  }

  @Post('event/:eventId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pay for event registration' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiQuery({ name: 'paymentMethodId', required: false, description: 'Payment method ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Payment initiated or completed' })
  async payForEvent(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Query('paymentMethodId') paymentMethodId?: string
  ) {
    return this.paymentsService.createEventPayment(req.user.sub, eventId, paymentMethodId);
  }

  @Get('callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle payment callback after 3D Secure' })
  @ApiQuery({ name: 'payment_id', description: 'Payment ID from YooKassa' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment callback processed successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['succeeded', 'failed'] },
        message: { type: 'string' },
        paymentId: { type: 'string' },
        redirectUrl: { type: 'string' },
      },
    },
  })
  async handlePaymentCallback(@Query() callbackDto: PaymentCallbackDto): Promise<{
    status: 'succeeded' | 'failed';
    message: string;
    paymentId?: string;
    redirectUrl?: string;
  }> {
    this.logger.log(`Processing payment callback for: ${callbackDto.payment_id}`);

    try {
      const result = await this.paymentsService.handlePaymentCallback(callbackDto.payment_id);

      return {
        status: 'succeeded',
        message: result.message,
        paymentId: result.paymentId,
        redirectUrl: result.redirectUrl,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Payment processing error';

      this.logger.error(`Payment callback failed: ${errorMessage}`);

      return {
        status: 'failed',
        message: errorMessage,
      };
    }
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get payment status' })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment status retrieved successfully',
  })
  async getPaymentStatus(@Req() req: AuthenticatedRequest, @Param('id') paymentId: string) {
    const payment = await this.paymentsService.getPaymentStatus(paymentId, req.user.sub);

    return {
      success: true,
      message: 'Payment status retrieved successfully',
      data: {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        createdAt: payment.createdAt,
        sessionId: payment.sessionId,
        errorMessage: payment.errorMessage,
      },
    };
  }
}
