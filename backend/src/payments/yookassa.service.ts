import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

interface YookassaConfig {
  shopId: string;
  secretKey: string;
  baseUrl: string;
}

interface YookassaPaymentResponse {
  id: string;
  status: string;
  confirmation: {
    confirmation_url: string;
  };
}

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
      const response = await fetch(`${this.config.baseUrl}/payments`, {
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

      const data: YookassaPaymentResponse = await response.json();
      this.logger.log(`Payment method attachment created successfully: ${data.id}`);

      return {
        confirmationUrl: data.confirmation.confirmation_url,
        paymentId: data.id,
      };
    } catch (error) {
      this.logger.error('Failed to create payment method attachment', error);
      throw new InternalServerErrorException(
        'Failed to initiate card attachment: ' + error.message
      );
    }
  }

  verifyWebhookSignature(body: string, signature: string): boolean {
    const secretKey = this.config.secretKey;
    const computedSignature = crypto.createHmac('sha256', secretKey).update(body).digest('base64');

    return computedSignature === signature;
  }

  async handlePaymentMethodWebhook(webhookData: any): Promise<{
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
  }> {
    const { object } = webhookData;

    if (object.status === 'succeeded' && object.payment_method?.saved) {
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

    throw new BadRequestException('Unhandled webhook type');
  }
}
