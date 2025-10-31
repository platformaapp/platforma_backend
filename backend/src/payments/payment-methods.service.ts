import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PaymentMethod,
  PaymentMethodStatus,
  PaymentProvider,
} from './entities/payment-method.entity';
import { User } from '../users/user.entity';
import { YookassaService } from './yookassa.service';

@Injectable()
export class PaymentMethodsService {
  constructor(
    @InjectRepository(PaymentMethod)
    private paymentMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private yookassaService: YookassaService,
    private configService: ConfigService
  ) {}

  async attachPaymentMethod(
    userId: string,
    provider: PaymentProvider = PaymentProvider.YOOKASSA
  ): Promise<{ confirmationUrl: string; attachmentId: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const returnUrl = `${this.configService.get('FRONTEND_URL')}/payment-methods/callback`;
    const { confirmationUrl, paymentId } =
      await this.yookassaService.createPaymentMethodAttachment(returnUrl);

    const paymentMethod = this.paymentMethodRepository.create({
      user,
      userId: user.id,
      provider,
      cardMasked: 'pending',
      cardToken: paymentId,
      status: PaymentMethodStatus.ACTIVE,
    });

    await this.paymentMethodRepository.save(paymentMethod);

    return {
      confirmationUrl,
      attachmentId: paymentMethod.id,
    };
  }

  async findByUserId(userId: string): Promise<PaymentMethod[]> {
    return this.paymentMethodRepository.find({
      where: {
        userId,
        status: PaymentMethodStatus.ACTIVE,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async setDefaultPaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: {
        id: paymentMethodId,
        userId,
        status: PaymentMethodStatus.ACTIVE,
      },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }

    await this.userRepository.update(userId, {
      defaultPaymentMethodId: paymentMethodId,
    });
  }
}
