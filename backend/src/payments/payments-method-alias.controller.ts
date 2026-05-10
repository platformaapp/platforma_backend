import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudentGuard } from '../auth/guards/student.guard';
import { PaymentMethodsService } from './payment-methods.service';
import type { AuthenticatedRequest } from '../utils/types';

/**
 * Alias controller so that /payments/method* mirrors /student/payment-methods*.
 * Keeps backward compatibility with frontend clients that use the shorter path.
 */
@ApiTags('Payments Method (alias)')
@UseGuards(JwtAuthGuard, StudentGuard)
@Controller('payments/method')
export class PaymentsMethodAliasController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all payment methods (alias)' })
  async getPaymentMethods(@Req() req: AuthenticatedRequest) {
    const methods = await this.paymentMethodsService.findByUserId(req.user.sub);
    const def = await this.paymentMethodsService.getDefaultPaymentMethod(req.user.sub);
    return {
      success: true,
      data: {
        paymentMethods: methods.map((pm) => ({
          id: pm.id,
          cardMasked: pm.cardMasked,
          cardType: pm.cardType,
          expiryMonth: pm.expiryMonth,
          expiryYear: pm.expiryYear,
          isDefault: def?.id === pm.id,
          createdAt: pm.createdAt,
        })),
        total: methods.length,
      },
    };
  }

  /** DELETE /payments/method  — ID передаётся в теле { id } */
  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete payment method by ID in body (alias)' })
  async deleteByBody(
    @Req() req: AuthenticatedRequest,
    @Body() body: { id: string }
  ) {
    return this.paymentMethodsService.deletePaymentMethod(req.user.sub, body.id);
  }

  /** DELETE /payments/method/:id — ID в URL */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete payment method by ID in URL (alias)' })
  async deleteById(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string
  ) {
    return this.paymentMethodsService.deletePaymentMethod(req.user.sub, id);
  }

  @Patch(':id/default')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set default payment method (alias)' })
  async setDefault(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.paymentMethodsService.setDefaultPaymentMethod(req.user.sub, id);
  }

  @Post('bind')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bind card (alias)' })
  async bind(@Req() req: AuthenticatedRequest, @Body() body: { provider?: string }) {
    return this.paymentMethodsService.attachPaymentMethod(req.user.sub, body.provider as never);
  }
}
