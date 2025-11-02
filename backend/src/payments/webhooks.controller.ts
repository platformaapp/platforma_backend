import { Controller, Post, Body, Headers, HttpCode, HttpStatus, Logger, Req } from '@nestjs/common';
import express from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeController } from '@nestjs/swagger';
import { PaymentMethodsService } from './payment-methods.service';
import { YookassaService } from './yookassa.service';
import { YookassaWebhookDto } from './dto/yookassa-webhook.dto';

@ApiTags('Webhooks')
@ApiExcludeController()
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly paymentMethodsService: PaymentMethodsService,
    private readonly yookassaService: YookassaService
  ) {}

  @Post('yookassa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook для уведомлений от ЮКассы' })
  @ApiResponse({ status: 200, description: 'Webhook успешно обработан' })
  async handleYookassaWebhook(
    @Body() webhookData: YookassaWebhookDto,
    @Headers() signature: string,
    @Req() request: express.Request
  ) {
    console.log('=== YOOKASSA WEBHOOK RECEIVED ===');
    console.log(`Headers: ${JSON.stringify(request.headers)}`);
    console.log(`Signature header: ${signature}`);
    console.log(`Webhook data: ${JSON.stringify(webhookData)}`);

    try {
      const isValid = this.yookassaService.verifyWebhookSignature(
        JSON.stringify(webhookData),
        signature
      );

      if (!isValid) {
        this.logger.error('Invalid webhook signature');
        return { status: 'error', message: 'Invalid signature' };
      }

      this.logger.log('Webhook signature verified successfully');

      await this.paymentMethodsService.handleWebhook(webhookData);

      this.logger.log('Webhook processed successfully');
      return { status: 'success' };
    } catch (error) {
      this.logger.error('Error processing webhook', error);
    }
  }
}
