import { Module } from '@nestjs/common';
import { PaymentMethodsService } from './payment-methods.service';
import { PaymentMethodsController } from './payment-methods.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { User } from '../users/user.entity';
import { PaymentMethod } from './entities/payment-method.entity';
import { AuthModule } from '../auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Session } from '../session/entities/session.entity';
import { YookassaService } from './yookassa.service';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentMethod, Session, User]),
    AuthModule,
    JwtModule,
  ],
  controllers: [PaymentMethodsController, PaymentsController, WebhooksController],
  providers: [PaymentMethodsService, PaymentsService, YookassaService],
  exports: [PaymentMethodsService, YookassaService],
})
export class PaymentsModule {}
