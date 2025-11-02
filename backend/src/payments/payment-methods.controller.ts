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
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaymentMethodsService } from './payment-methods.service';
import { AttachPaymentMethodDto } from './dto/attach-payment-method.dto';
import type { AuthenticatedRequest } from '../utils/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudentGuard } from '../auth/guards/student.guard';
import { DeletePaymentMethodResponseDto } from './dto/delete-payment-method.dto';

@ApiTags('Student Payment Methods')
@Controller('student/payment-methods')
export class PaymentMethodsController {
  private readonly logger = new Logger(PaymentMethodsController.name);

  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Post('attach')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, StudentGuard)
  @ApiOperation({ summary: 'Link a bank card' })
  @ApiResponse({
    status: 200,
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
        attachmentId: result.attachmentId,
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
}
