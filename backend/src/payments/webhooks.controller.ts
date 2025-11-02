import { Controller, Post, Body, Headers, HttpCode, HttpStatus, Logger } from '@nestjs/common';
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
    @Headers('yookassa-signature') signature: string
  ) {
    this.logger.log('Received Yookassa webhook', webhookData);

    try {
      const isValid = this.yookassaService.verifyWebhookSignature(
        JSON.stringify(webhookData),
        signature
      );

      if (!isValid) {
        this.logger.error('Invalid webhook signature');
        return { status: 'error', message: 'Invalid signature' };
      }

      await this.paymentMethodsService.handleWebhook(webhookData);

      this.logger.log('Webhook processed successfully');
      return { status: 'success' };
    } catch (error) {
      this.logger.error('Error processing webhook', error);
      return { status: 'error', message: error.message };
    }
  }
}
