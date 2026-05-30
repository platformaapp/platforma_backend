import { Controller, Post, HttpCode, HttpStatus, Logger, Req } from '@nestjs/common';
import { ApiTags, ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { PaymentMethodsService } from './payment-methods.service';
import { YookassaService } from './yookassa.service';
import { YookassaWebhookDto } from './dto/yookassa-webhook.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Webhooks')
@ApiExcludeController()
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly paymentMethodsService: PaymentMethodsService,
    private readonly yookassaService: YookassaService,
    private readonly paymentsService: PaymentsService
  ) {}

  @Post('yookassa')
  @HttpCode(HttpStatus.OK)
  async handleYookassaWebhook(@Req() req: Request) {
    this.logger.log('=== YOOKASSA WEBHOOK RECEIVED ===');

    let webhookData: YookassaWebhookDto;

    try {
      const rawBody = req.body as unknown;
      if (typeof rawBody === 'string') {
        webhookData = JSON.parse(rawBody) as YookassaWebhookDto;
      } else if (Buffer.isBuffer(rawBody)) {
        webhookData = JSON.parse(rawBody.toString('utf-8')) as YookassaWebhookDto;
      } else if (rawBody && typeof rawBody === 'object') {
        webhookData = rawBody as YookassaWebhookDto;
      } else {
        this.logger.error('No parseable body available');
        return { status: 'error', message: 'No body' };
      }
    } catch {
      this.logger.error('Failed to parse webhook body');
      return { status: 'error', message: 'Invalid JSON body' };
    }

    try {
      this.logger.log(`Webhook event: ${webhookData.event}, Status: ${webhookData.object.status}`);

      // Обработка вебхука
      if (this.isPaymentMethodWebhook(webhookData)) {
        await this.paymentMethodsService.handleWebhook(webhookData);
      } else if (this.isSessionPaymentWebhook(webhookData)) {
        await this.paymentsService.handlePaymentWebhook(webhookData);
      } else {
        this.logger.warn(`Unhandled webhook type: ${webhookData.event}`);
      }

      this.logger.log('Webhook processed successfully');
      return { status: 'success' };
    } catch (error) {
      this.logger.error('Error processing webhook', error);
      return { status: 'error', message: 'Processing failed' };
    }
  }

  private isPaymentMethodWebhook(webhookData: YookassaWebhookDto): boolean {
    const metaType = webhookData.object.metadata?.type;
    return (
      webhookData.object.payment_method?.saved === true &&
      metaType !== 'session_payment' &&
      metaType !== 'event_payment'
    );
  }

  private isSessionPaymentWebhook(webhookData: YookassaWebhookDto): boolean {
    const metaType = webhookData.object.metadata?.type;
    // Handles both session_payment (old name kept for backwards compat) and event_payment.
    return metaType === 'session_payment' || metaType === 'event_payment';
  }
}
