import { Module } from '@nestjs/common';
import { PaymentMethodsService } from './payment-methods.service';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentsMethodAliasController } from './payments-method-alias.controller';
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
import { Transaction } from './entities/transaction.entity';
import { TransactionsService } from './transactions.service';
import { ConfigModule } from '@nestjs/config';
import { UserEvent } from 'src/events/entities/user-event.entity';
import { Event } from 'src/events/entities/event.entity';
import { TutorPayout } from 'src/payouts/entities/tutor-payout.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentMethod, Session, User, Transaction, UserEvent, Event, TutorPayout]),
    AuthModule,
    JwtModule,
    ConfigModule,
  ],
  controllers: [PaymentMethodsController, PaymentsMethodAliasController, PaymentsController, WebhooksController],
  providers: [PaymentMethodsService, PaymentsService, YookassaService, TransactionsService],
  exports: [PaymentMethodsService, PaymentsService, YookassaService, TransactionsService],
})
export class PaymentsModule {}
