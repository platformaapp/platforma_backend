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
import { PaymentMethod } from './payment-method.entity';

export enum TransactionStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  CANCELED = 'canceled',
  FAILED = 'failed',
  WAITING_FOR_CAPTURE = 'waiting_for_capture',
}

export enum TransactionType {
  CARD_BINDING = 'card_binding',
  SESSION_PAYMENT = 'session_payment',
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => PaymentMethod, { nullable: true })
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethod: PaymentMethod;

  @Column({ name: 'payment_method_id', nullable: true })
  paymentMethodId: string;

  @Column({ name: 'yookassa_payment_id', nullable: true })
  yookassaPaymentId: string;

  @Column({
    type: 'enum',
    enum: TransactionType,
    default: TransactionType.CARD_BINDING,
  })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1.0 })
  amount: number;

  @Column({ type: 'text', default: 'Привязка карты' })
  description: string;

  @Column({ name: 'error_reason', type: 'text', nullable: true })
  errorReason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
