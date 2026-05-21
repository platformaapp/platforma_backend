import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';
import { TutorPayout } from './entities/tutor-payout.entity';
import { Payment } from 'src/payments/entities/payment.entity';
import { UserEvent } from 'src/events/entities/user-event.entity';
import { User } from 'src/users/user.entity';
import { PaymentsModule } from 'src/payments/payments.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TutorPayout, Payment, UserEvent, User]),
    PaymentsModule,
    AuthModule,
  ],
  controllers: [PayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
