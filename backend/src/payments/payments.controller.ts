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

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create payment for session' })
  @ApiResponse({
    status: 201,
    description: 'Payment created successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request or session already paid' })
  @ApiResponse({ status: 404, description: 'Session or payment method not found' })
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

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get payment status' })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiResponse({
    status: 200,
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

  @Get('callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle payment callback after 3D Secure' })
  @ApiQuery({ name: 'payment_id', description: 'Payment ID from YooKassa' })
  @ApiResponse({
    status: 200,
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
      this.logger.error(`Payment callback failed: ${error.message}`);

      return {
        status: 'failed',
        message: error.message || 'Ошибка обработки платежа',
      };
    }
  }
}
