import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Param,
  Logger,
  Query,
} from '@nestjs/common';
import type { Response } from 'express';
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
@Controller('student/payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, StudentGuard)
  @ApiBearerAuth('JWT-auth')
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

  @Get('callback')
  @ApiOperation({ summary: 'Handle payment callback after YooKassa redirect' })
  @ApiQuery({ name: 'payment_id', required: false, description: 'YooKassa payment ID' })
  @ApiQuery({ name: 'method_id', required: false, description: 'Payment method ID (card binding)' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend after processing' })
  async handlePaymentCallback(
    @Query() callbackDto: PaymentCallbackDto,
    @Res() res: Response
  ): Promise<void> {
    this.logger.log(
      `Processing payment callback: payment_id=${callbackDto.payment_id}, method_id=${callbackDto.method_id}`
    );

    try {
      const result = await this.paymentsService.handlePaymentCallback(
        callbackDto.payment_id,
        callbackDto.method_id
      );
      res.redirect(result.redirectUrl);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Payment processing error';
      this.logger.error(`Payment callback failed: ${errorMessage}`);
      res.redirect(
        await this.paymentsService.getFailureRedirectUrl(callbackDto.method_id)
      );
    }
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, StudentGuard)
  @ApiBearerAuth('JWT-auth')
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
