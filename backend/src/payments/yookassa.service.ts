import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import {
  CreateSessionPaymentParams,
  YookassaConfig,
  YookassaPayment,
  YookassaPaymentResponse,
  YookassaRefundResponse,
  YookassaSessionPaymentResponse,
  YookassaWebhook,
} from '../utils/types';

// Published YooKassa notification IP ranges (https://yookassa.ru/developers/using-api/webhooks)
const YOOKASSA_IP_RANGES = [
  '185.71.76.0/27',
  '185.71.77.0/27',
  '77.75.153.0/25',
  '77.75.156.11/32',
  '77.75.156.35/32',
  '77.75.154.128/25',
];

function ipToUint32(ip: string): number {
  return ip.split('.').reduce((acc, octet) => ((acc << 8) | parseInt(octet, 10)) >>> 0, 0);
}

function isIpInCidr(ip: string, cidr: string): boolean {
  if (!ip || !ip.match(/^\d+\.\d+\.\d+\.\d+$/)) return false;
  const [range, bits = '32'] = cidr.split('/');
  const maskBits = parseInt(bits, 10);
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
  return (ipToUint32(ip) & mask) === (ipToUint32(range) & mask);
}

export function isYookassaIp(ip: string): boolean {
  return YOOKASSA_IP_RANGES.some((cidr) => isIpInCidr(ip, cidr));
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

    const frontendUrl = configService.get<string>('FRONTEND_URL', 'https://platformaapp.ru');
    this.logger.warn(
      `[ACTION REQUIRED] YooKassa webhook URL must be configured in the merchant dashboard: ${frontendUrl}/api/webhooks/yookassa`
    );
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

      const raw: unknown = await response.json();
      const data = raw as T;

      this.logger.debug(`Yookassa API response: ${JSON.stringify(data)}`);

      return data;
    } catch (error) {
      this.logger.error(`Yookassa API request failed for endpoint: ${endpoint}`, error);
      throw error;
    }
  }

  async createPaymentMethodAttachment(
    returnUrl: string,
    customerEmail?: string
  ): Promise<{ confirmationUrl: string; paymentId: string }> {
    const idempotenceKey = uuidv4();

    const payload: Record<string, unknown> = {
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
      ...(customerEmail && {
        receipt: {
          customer: { email: customerEmail },
          items: [{
            description: 'Привязка банковской карты',
            quantity: '1.00',
            amount: { value: '1.00', currency: 'RUB' },
            vat_code: 1,
            payment_subject: 'service',
            payment_mode: 'full_payment',
          }],
        },
      }),
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

  /**
   * Verifies that the webhook request originated from YooKassa by checking the
   * sender's IP against YooKassa's published notification IP ranges.
   * In development/test mode the check is bypassed so local testing works.
   */
  verifyWebhookIp(clientIp: string): boolean {
    const isDev =
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === 'test' ||
      this.config.secretKey?.startsWith('test_');

    if (isDev) {
      this.logger.debug(`[dev] Webhook IP check skipped for ${clientIp}`);
      return true;
    }

    const allowed = isYookassaIp(clientIp);
    if (!allowed) {
      this.logger.warn(`Webhook from unexpected IP: ${clientIp}`);
    }
    return allowed;
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

    const payload: Record<string, unknown> = {
      amount: {
        value: amount.toFixed(2),
        currency: 'RUB',
      },
      capture: true,
      description: params.description,
      metadata: {
        payment_id: params.paymentId,
        type: params.metadataType ?? 'session_payment',
      },
      ...(params.customerEmail && {
        receipt: {
          customer: { email: params.customerEmail },
          items: [{
            description: params.description.substring(0, 128),
            quantity: '1.00',
            amount: { value: amount.toFixed(2), currency: 'RUB' },
            vat_code: 1,
            payment_subject: 'service',
            payment_mode: 'full_payment',
          }],
        },
      }),
    };

    if (params.paymentMethodToken) {
      // Saved card auto-charge: confirmation must be omitted per YooKassa API rules
      payload.payment_method_id = params.paymentMethodToken;
    } else {
      // New payment: redirect user to YooKassa form
      payload.confirmation = {
        type: 'redirect',
        return_url: params.returnUrl,
      };
    }

    this.logger.log(`Creating session payment: amount=${amount}, payment_method_id_prefix=${String(params.paymentMethodToken).substring(0, 8)}..., paymentId=${params.paymentId}`);

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

  async createPayout(params: {
    amount: number;
    method: 'bank_card' | 'sbp';
    destination: string;
    description: string;
    payoutId: string;
  }): Promise<{ id: string; status: string }> {
    const payoutBaseUrl = this.configService.get<string>(
      'YOOKASSA_PAYOUT_URL',
      'https://payouts.yookassa.ru/api/v1'
    );
    const url = `${payoutBaseUrl}/payouts`;

    const payoutDestinationData =
      params.method === 'bank_card'
        ? { type: 'bank_card', card: { number: params.destination } }
        : { type: 'sbp', phone: params.destination };

    const payload = {
      amount: { value: params.amount.toFixed(2), currency: 'RUB' },
      payout_destination_data: payoutDestinationData,
      description: params.description,
      metadata: { payout_id: params.payoutId },
    };

    this.logger.log(`Creating YooKassa payout: amount=${params.amount}, method=${params.method}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotence-Key': params.payoutId,
          Authorization: `Basic ${Buffer.from(`${this.config.shopId}:${this.config.secretKey}`).toString('base64')}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`YooKassa payout error: ${response.status} - ${errorText}`);
        throw new Error(`YooKassa payout error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as { id: string; status: string };
      this.logger.log(`YooKassa payout created: ${data.id}, status: ${data.status}`);
      return data;
    } catch (error) {
      this.logger.error('Failed to create YooKassa payout', error);
      throw error;
    }
  }

  async createRefund(params: {
    yookassaPaymentId: string;
    amount: number;
    description: string;
  }): Promise<YookassaRefundResponse> {
    const idempotenceKey = uuidv4();

    const payload = {
      payment_id: params.yookassaPaymentId,
      amount: {
        value: params.amount.toFixed(2),
        currency: 'RUB',
      },
      description: params.description,
    };

    this.logger.log(
      `Creating refund: paymentId=${params.yookassaPaymentId}, amount=${params.amount}`
    );

    try {
      const response = await fetch(`${this.config.baseUrl}/refunds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotence-Key': idempotenceKey,
          Authorization: `Basic ${Buffer.from(`${this.config.shopId}:${this.config.secretKey}`).toString('base64')}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`YooKassa refund error: ${response.status} - ${errorText}`);
        throw new Error(`YooKassa refund error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as YookassaRefundResponse;
      this.logger.log(`Refund created: ${data.id}, status: ${data.status}`);
      return data;
    } catch (error) {
      this.logger.error('Failed to create YooKassa refund', error);
      throw new InternalServerErrorException(
        `Ошибка возврата платежа: ${(error as Error).message}`
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

  async getPayment(paymentId: string): Promise<YookassaPayment> {
    const url = `${this.config.baseUrl}/payments/${paymentId}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${this.config.shopId}:${this.config.secretKey}`).toString('base64')}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Yookassa API error: ${response.status} - ${errorText}`);
      }

      const raw: unknown = await response.json();
      return raw as YookassaPayment;
    } catch (error: unknown) {
      this.logger.error(`Failed to get payment ${paymentId}`, error);
      throw new InternalServerErrorException(`Failed to get payment info`);
    }
  }
}
