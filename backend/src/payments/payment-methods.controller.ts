import { Controller, Post, Body, Req, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaymentMethodsService } from './payment-methods.service';
import { AttachPaymentMethodDto } from './dto/attach-payment-method.dto';
import type { AuthenticatedRequest } from '../utils/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudentGuard } from '../auth/guards/student.guard';

@ApiTags('Student Payment Methods')
@UseGuards(JwtAuthGuard, StudentGuard)
@Controller('student/payment-methods')
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Post('attach')
  @HttpCode(HttpStatus.OK)
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
}
