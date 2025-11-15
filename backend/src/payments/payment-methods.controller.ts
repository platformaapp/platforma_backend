import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  Delete,
  Param,
  Logger,
  Get,
  Patch,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaymentMethodsService } from './payment-methods.service';
import { AttachPaymentMethodDto } from './dto/attach-payment-method.dto';
import type { AuthenticatedRequest } from '../utils/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudentGuard } from '../auth/guards/student.guard';
import { DeletePaymentMethodResponseDto } from './dto/delete-payment-method.dto';
import { SetDefaultPaymentMethodResponseDto } from './dto/set-default-payment-method.dto';

@ApiTags('Student Payment Methods')
@Controller('student/payment-methods')
export class PaymentMethodsController {
  private readonly logger = new Logger(PaymentMethodsController.name);

  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, StudentGuard)
  @ApiOperation({ summary: 'Get all payment methods for user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment methods retrieved successfully',
  })
  async getPaymentMethods(@Req() req: AuthenticatedRequest) {
    const paymentMethods = await this.paymentMethodsService.findByUserId(req.user.sub);

    const defaultPaymentMethod = await this.paymentMethodsService.getDefaultPaymentMethod(
      req.user.sub
    );

    return {
      success: true,
      message: 'Payment methods retrieved successfully',
      data: {
        paymentMethods: paymentMethods.map((pm) => ({
          id: pm.id,
          cardMasked: pm.cardMasked,
          cardType: pm.cardType,
          expiryMonth: pm.expiryMonth,
          expiryYear: pm.expiryYear,
          isDefault: defaultPaymentMethod?.id === pm.id,
          createdAt: pm.createdAt,
        })),
        total: paymentMethods.length,
      },
    };
  }

  @Post('bind')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, StudentGuard)
  @ApiOperation({ summary: 'Link a bank card' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Card binding initiated. Redirect user to confirmationUrl',
  })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async attachPaymentMethod(
    @Req() req: AuthenticatedRequest,
    @Body() attachPaymentMethodDto: AttachPaymentMethodDto
  ) {
    const result = await this.paymentMethodsService.attachPaymentMethod(
      req.user.sub,
      attachPaymentMethodDto.provider
    );

    return {
      success: true,
      data: {
        confirmationUrl: result.confirmationUrl,
        attachmentId: result.transactionId,
      },
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, StudentGuard)
  @ApiOperation({ summary: 'Delete payment method' })
  @ApiParam({ name: 'id', description: 'Payment method ID' })
  @ApiResponse({
    status: 200,
    description: 'Payment method successfully deleted',
    type: DeletePaymentMethodResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Cannot delete payment method with active payments' })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  async deletePaymentMethod(
    @Req() req: AuthenticatedRequest,
    @Param('id') paymentMethodId: string
  ): Promise<DeletePaymentMethodResponseDto> {
    this.logger.log(`User ${req.user.sub} attempting to delete payment method ${paymentMethodId}`);

    return await this.paymentMethodsService.deletePaymentMethod(req.user.sub, paymentMethodId);
  }

  @Patch(':id/default')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, StudentGuard)
  @ApiOperation({ summary: 'Set payment method as default' })
  @ApiParam({ name: 'id', description: 'Payment method ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment method successfully set as default',
    type: SetDefaultPaymentMethodResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  async setDefaultPaymentMethod(
    @Req() req: AuthenticatedRequest,
    @Param('id') paymentMethodId: string
  ): Promise<SetDefaultPaymentMethodResponseDto> {
    this.logger.log(`User ${req.user.sub} setting payment method ${paymentMethodId} as default`);

    return await this.paymentMethodsService.setDefaultPaymentMethod(req.user.sub, paymentMethodId);
  }

  @Get('default')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, StudentGuard)
  @ApiOperation({ summary: 'Get default payment method' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Default payment method retrieved successfully',
  })
  async getDefaultPaymentMethod(@Req() req: AuthenticatedRequest) {
    const defaultPaymentMethod = await this.paymentMethodsService.getDefaultPaymentMethod(
      req.user.sub
    );

    if (!defaultPaymentMethod) {
      return {
        success: true,
        message: 'No default payment method set',
        data: null,
      };
    }

    return {
      success: true,
      message: 'Default payment method retrieved successfully',
      data: {
        id: defaultPaymentMethod.id,
        cardMasked: defaultPaymentMethod.cardMasked,
        cardType: defaultPaymentMethod.cardType,
        expiryMonth: defaultPaymentMethod.expiryMonth,
        expiryYear: defaultPaymentMethod.expiryYear,
        isDefault: true,
      },
    };
  }
}
