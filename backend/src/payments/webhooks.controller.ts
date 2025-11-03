import { Controller, Post, Body, Headers, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiExcludeController } from '@nestjs/swagger';
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
  async handleYookassaWebhook(
    @Body() webhookData: YookassaWebhookDto,
    @Headers('Webhook-Signature') signatureHeader: string
  ) {
    console.log('=== YOOKASSA WEBHOOK ===');
    console.log(`Event type: ${webhookData.type}`);
    console.log(`Webhook event: ${webhookData.event}`);
    console.log(`Payment status: ${webhookData.object.status}`);

    try {
      // Верификация подписи
      const signature = signatureHeader?.replace(/^(Signature|HMAC)\s+/i, '');
      if (!signature) {
        this.logger.error('No signature found in Authorization header');
        return { status: 'error', message: 'Missing signature' };
      }

      const isValid = this.yookassaService.verifyWebhookSignature(
        JSON.stringify(webhookData),
        signature
      );

      if (!isValid) {
        this.logger.error('Invalid webhook signature');
        return { status: 'error', message: 'Invalid signature' };
      }

      this.logger.log('Webhook signature verified successfully');

      // Определяем тип вебхука и направляем в соответствующий сервис
      if (this.isPaymentMethodWebhook(webhookData)) {
        // Вебхук для привязки карты
        await this.paymentMethodsService.handleWebhook(webhookData);
      } else if (this.isSessionPaymentWebhook(webhookData)) {
        // Вебхук для платежа сессии
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
    // Привязка карты: есть saved: true и нет метаданных сессии
    return (
      webhookData.object.payment_method?.saved === true &&
      webhookData.object.metadata?.type !== 'session_payment'
    );
  }

  private isSessionPaymentWebhook(webhookData: YookassaWebhookDto): boolean {
    // Платеж сессии: есть метаданные с типом session_payment
    return webhookData.object.metadata?.type === 'session_payment';
  }
}
