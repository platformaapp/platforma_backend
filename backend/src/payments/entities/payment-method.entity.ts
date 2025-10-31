import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';

export enum PaymentProvider {
  YOOKASSA = 'yookassa',
  STRIPE = 'stripe',
  TINKOFF = 'tinkoff',
}

export enum PaymentMethodStatus {
  ACTIVE = 'active',
  DELETED = 'deleted',
}

@Entity('payment_methods')
export class PaymentMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.paymentMethods, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({
    type: 'enum',
    enum: PaymentProvider,
    default: PaymentProvider.YOOKASSA,
  })
  provider: PaymentProvider;

  @Column({ name: 'card_masked', type: 'varchar', length: 20 })
  cardMasked: string;

  @Column({ name: 'card_token', type: 'text' })
  cardToken: string;

  @Column({
    type: 'enum',
    enum: PaymentMethodStatus,
    default: PaymentMethodStatus.ACTIVE,
  })
  status: PaymentMethodStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
