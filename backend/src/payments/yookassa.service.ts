import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import {
  CreateSessionPaymentParams,
  YookassaConfig,
  YookassaPaymentResponse,
  YookassaSessionPaymentResponse,
  YookassaWebhook,
} from '../utils/types';

@Injectable()
export class YookassaService {
  private readonly logger = new Logger(YookassaService.name);
  private readonly config: YookassaConfig;

  constructor(private configService: ConfigService) {
    this.config = {
      shopId: this.configService.get<string>('YOOKASSA_SHOP_ID'),
      secretKey: this.configService.get<string>('YOOKASSA_SECRET_KEY'),
      baseUrl: this.configService.get<string>('YOOKASSA_BASE_URL', 'https://api.yookassa.ru/v3'),
    };

    if (!this.config.shopId || !this.config.secretKey) {
      this.logger.error(
        'Yookassa configuration is missing. Check YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY environment variables.'
      );
    } else {
      this.logger.log(
        `Yookassa service initialized with shopId: ${this.config.shopId.substring(0, 10)}...`
      );
    }
  }

  private async makeYookassaRequest<T>(
    endpoint: string,
    payload: any,
    idempotenceKey: string
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;

    this.logger.debug(`Making request to Yookassa API: ${url}`);
    this.logger.debug(`Request payload: ${JSON.stringify(payload)}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotence-Key': idempotenceKey,
          Authorization: `Basic ${Buffer.from(`${this.config.shopId}:${this.config.secretKey}`).toString('base64')}`,
        },
        body: JSON.stringify(payload),
      });

      this.logger.debug(`Yookassa API response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Yookassa API error: ${response.status} - ${errorText}`);
        throw new Error(`Yookassa API error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as T;
      this.logger.debug(`Yookassa API response: ${JSON.stringify(data)}`);

      return data;
    } catch (error) {
      this.logger.error(`Yookassa API request failed for endpoint: ${endpoint}`, error);
      throw error;
    }
  }

  async createPaymentMethodAttachment(
    returnUrl: string
  ): Promise<{ confirmationUrl: string; paymentId: string }> {
    const idempotenceKey = uuidv4();

    const payload = {
      amount: {
        value: '1.00',
        currency: 'RUB',
      },
      capture: false,
      confirmation: {
        type: 'redirect',
        return_url: returnUrl,
      },
      description: 'Привязка банковской карты',
      save_payment_method: true,
    };

    this.logger.debug(
      `Creating payment method attachment with payload: ${JSON.stringify(payload)}`
    );

    try {
      const data = await this.makeYookassaRequest<YookassaPaymentResponse>(
        '/payments',
        payload,
        idempotenceKey
      );

      this.logger.log(`Payment method attachment created successfully: ${data.id}`);

      return {
        confirmationUrl: data.confirmation.confirmation_url,
        paymentId: data.id,
      };
    } catch (error) {
      this.logger.error('Failed to create payment method attachment', error);
      throw new InternalServerErrorException(
        'Failed to initiate card attachment: ' + (error as Error).message
      );
    }
  }

  verifyWebhookSignature(body: string, signature: string): boolean {
    // Минимальная проверка - есть ли вообще подпись
    if (!signature) {
      console.error('No signature provided');
      return false;
    }

    // Для тестового режима пропускаем проверку
    if (this.config.secretKey?.includes('test') || process.env.NODE_ENV === 'development') {
      console.log('Development mode - signature verification skipped');
      return true;
    }

    console.log('Production mode - but signature verification not implemented yet');
    return true; // TODO: Реализовать для продакшена
  }

  handlePaymentMethodWebhook(webhookData: YookassaWebhook): {
    paymentId: string;
    status: string;
    paymentMethodId?: string;
    cardDetails?: {
      first6: string;
      last4: string;
      cardType: string;
      expiryMonth: string;
      expiryYear: string;
    };
  } {
    const { object } = webhookData;

    if (
      (object.status === 'succeeded' || object.status === 'waiting_for_capture') &&
      object.payment_method?.saved
    ) {
      return {
        paymentId: object.id,
        status: 'succeeded',
        paymentMethodId: object.payment_method.id,
        cardDetails: object.payment_method.card
          ? {
              first6: object.payment_method.card.first6,
              last4: object.payment_method.card.last4,
              cardType: object.payment_method.card.card_type,
              expiryMonth: object.payment_method.card.expiry_month,
              expiryYear: object.payment_method.card.expiry_year,
            }
          : undefined,
      };
    }

    if (object.status === 'canceled' || object.status === 'failed') {
      return {
        paymentId: object.id,
        status: object.status,
      };
    }

    if (object.status === 'pending') {
      return {
        paymentId: object.id,
        status: object.status,
      };
    }

    this.logger.warn(`Unhandled webhook event: ${webhookData.event}`);
    throw new BadRequestException(`Unhandled webhook type: ${webhookData.event}`);
  }

  async createSessionPayment(
    params: CreateSessionPaymentParams
  ): Promise<YookassaSessionPaymentResponse> {
    const idempotenceKey = uuidv4();

    const amount = Number(params.amount);

    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException('Invalid amount provided');
    }

    const payload = {
      amount: {
        value: amount.toFixed(2),
        currency: 'RUB',
      },
      payment_method_id: params.paymentMethodToken,
      capture: true,
      description: params.description,
      confirmation: {
        type: 'redirect',
        return_url: params.returnUrl,
      },
      metadata: {
        payment_id: params.paymentId,
        type: 'session_payment',
      },
    };

    this.logger.debug(`Creating session payment with payload: ${JSON.stringify(payload)}`);

    try {
      const data = await this.makeYookassaRequest<YookassaPaymentResponse>(
        '/payments',
        payload,
        idempotenceKey
      );

      this.logger.log(`Session payment created successfully: ${data.id}, status: ${data.status}`);

      return {
        id: data.id,
        status: data.status,
        confirmation_url: data.confirmation?.confirmation_url,
      };
    } catch (error) {
      this.logger.error('Failed to create session payment', error);
      throw new InternalServerErrorException(
        `Failed to create payment: ${(error as Error).message}`
      );
    }
  }

  async capturePayment(paymentId: string): Promise<void> {
    const idempotenceKey = uuidv4();

    try {
      await this.makeYookassaRequest(`/payments/${paymentId}/capture`, {}, idempotenceKey);

      this.logger.log(`Payment ${paymentId} captured successfully`);
    } catch (error) {
      this.logger.error(`Failed to capture payment ${paymentId}`, error);
      throw error;
    }
  }
}
