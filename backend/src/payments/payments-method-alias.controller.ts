import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentMethodsService } from './payment-methods.service';
import type { AuthenticatedRequest } from '../utils/types';
import { Logger } from '@nestjs/common';

@ApiTags('Payments Method (alias)')
@UseGuards(JwtAuthGuard)
@Controller('payments/method')
export class PaymentsMethodAliasController {
  private readonly logger = new Logger(PaymentsMethodAliasController.name);

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

  /** DELETE /payments/method  — ID в теле { id }, query ?id= или query ?paymentMethodId= */
  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete payment method by ID in body or query (alias)' })
  async deleteByBody(
    @Req() req: AuthenticatedRequest,
    @Body() body: { id?: string; paymentMethodId?: string },
    @Query('id') queryId?: string,
    @Query('paymentMethodId') queryPmId?: string
  ) {
    this.logger.log(`DELETE /payments/method — body=${JSON.stringify(body)} queryId=${queryId} queryPmId=${queryPmId}`);
    const id = body?.id ?? body?.paymentMethodId ?? queryId ?? queryPmId;

    if (id) {
      return this.paymentMethodsService.deletePaymentMethod(req.user.sub, id);
    }

    // ID не передан — удаляем единственную активную карту пользователя
    const methods = await this.paymentMethodsService.findByUserId(req.user.sub);
    if (methods.length === 0) {
      throw new BadRequestException('No active payment method found');
    }
    return this.paymentMethodsService.deletePaymentMethod(req.user.sub, methods[0].id);
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
