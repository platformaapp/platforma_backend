import { Controller, Post, HttpCode, HttpStatus, Logger, Req } from '@nestjs/common';
import { ApiTags, ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { PaymentMethodsService } from './payment-methods.service';
import { YookassaService } from './yookassa.service';
import { YookassaWebhookDto } from './dto/yookassa-webhook.dto';
import { PaymentsService } from './payments.service';
import type { YookassaPayoutWebhook } from '../utils/types';

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

    // --- IP verification ---
    const clientIp = this.extractClientIp(req);
    if (!this.yookassaService.verifyWebhookIp(clientIp)) {
      // Return 200 so YooKassa does not keep retrying, but do not process the body.
      this.logger.error(`Webhook rejected: IP ${clientIp} is not in YooKassa allowlist`);
      return { status: 'ignored' };
    }

    // --- Body parsing ---
    let rawBody: unknown;
    try {
      const bodyRaw = req.body as unknown;
      if (typeof bodyRaw === 'string') {
        rawBody = JSON.parse(bodyRaw);
      } else if (Buffer.isBuffer(bodyRaw)) {
        rawBody = JSON.parse(bodyRaw.toString('utf-8'));
      } else if (bodyRaw && typeof bodyRaw === 'object') {
        rawBody = bodyRaw;
      } else {
        this.logger.error('No parseable body available');
        return { status: 'error', message: 'No body' };
      }
    } catch {
      this.logger.error('Failed to parse webhook body');
      return { status: 'error', message: 'Invalid JSON body' };
    }

    const event = (rawBody as { event?: string })?.event ?? '';
    this.logger.log(`Webhook event: ${event}`);

    try {
      // Payout webhooks have a different object shape
      if (event.startsWith('payout.')) {
        await this.handlePayoutWebhook(rawBody as YookassaPayoutWebhook);
      } else {
        const webhookData = rawBody as YookassaWebhookDto;
        this.logger.log(`Payment status: ${webhookData.object?.status}`);

        if (this.isPaymentMethodWebhook(webhookData)) {
          await this.paymentMethodsService.handleWebhook(webhookData);
        } else if (this.isSessionPaymentWebhook(webhookData)) {
          await this.paymentsService.handlePaymentWebhook(webhookData);
        } else {
          this.logger.warn(`Unhandled webhook type: ${event}`);
        }
      }

      this.logger.log('Webhook processed successfully');
      return { status: 'success' };
    } catch (error) {
      this.logger.error('Error processing webhook', error);
      return { status: 'error', message: 'Processing failed' };
    }
  }

  private async handlePayoutWebhook(data: YookassaPayoutWebhook): Promise<void> {
    const { object, event } = data;
    this.logger.log(`Payout webhook: event=${event}, id=${object?.id}, status=${object?.status}`);

    if (!object?.id) {
      this.logger.warn('Payout webhook missing object.id');
      return;
    }

    const errorDescription = object.error?.description;
    await this.paymentsService.handlePayoutWebhook(object.id, object.status, errorDescription);
  }

  private extractClientIp(req: Request): string {
    // Trust X-Forwarded-For set by a reverse proxy (take the first, leftmost IP)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return first.trim();
    }
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }
    return req.socket?.remoteAddress ?? req.ip ?? '';
  }

  private isPaymentMethodWebhook(webhookData: YookassaWebhookDto): boolean {
    const metaType = webhookData.object?.metadata?.type;
    return (
      webhookData.object?.payment_method?.saved === true &&
      metaType !== 'session_payment' &&
      metaType !== 'event_payment'
    );
  }

  private isSessionPaymentWebhook(webhookData: YookassaWebhookDto): boolean {
    const metaType = webhookData.object?.metadata?.type;
    return metaType === 'session_payment' || metaType === 'event_payment';
  }
}
