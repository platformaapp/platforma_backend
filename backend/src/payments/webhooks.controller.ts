import { Controller, Post, Headers, HttpCode, HttpStatus, Logger, Req } from '@nestjs/common';
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
  async handleYookassaWebhook(@Req() req: Request, @Headers() headers: Record<string, string>) {
    // Получаем RAW тело как есть
    const rawBody = req.body as unknown as string | undefined;
    const signature = headers['signature'] ?? headers['Signature'] ?? headers['HTTP_SIGNATURE'];

    this.logger.log('=== YOOKASSA WEBHOOK RECEIVED ===');
    this.logger.log('Raw body length:', rawBody?.length ?? 'undefined');
    this.logger.log('Signature header:', signature);

    if (!rawBody) {
      this.logger.error('No raw body available');
      return { status: 'error', message: 'No raw body' };
    }

    if (!signature || Array.isArray(signature)) {
      this.logger.error('No valid signature found in headers');
      return { status: 'error', message: 'Missing or invalid signature' };
    }

    try {
      // Используем оригинальное тело БЕЗ нормализации
      const isValid = this.yookassaService.verifyWebhookSignature(rawBody, signature);

      if (!isValid) {
        this.logger.error('Invalid webhook signature');
        return { status: 'error', message: 'Invalid signature' };
      }

      this.logger.log('Webhook signature verified successfully');

      // Парсим JSON только после верификации
      const webhookData = JSON.parse(rawBody) as YookassaWebhookDto;

      console.log(`Webhook event: ${webhookData.event}, Status: ${webhookData.object.status}`);

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
