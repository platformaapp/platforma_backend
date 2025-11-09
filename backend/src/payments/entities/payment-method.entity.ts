import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { Transaction } from './transaction.entity';

export enum PaymentProvider {
  YOOKASSA = 'yookassa',
  STRIPE = 'stripe',
  TINKOFF = 'tinkoff',
}

export enum PaymentMethodStatus {
  ACTIVE = 'active',
  DELETED = 'deleted',
  PENDING = 'pending',
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

  @Column({ name: 'card_type', type: 'varchar', nullable: true })
  cardType: string;

  @Column({ name: 'expiry_month', type: 'varchar', length: 2, nullable: true })
  expiryMonth: string;

  @Column({ name: 'expiry_year', type: 'varchar', length: 4, nullable: true })
  expiryYear: string;

  @Column({ name: 'yookassa_payment_id', type: 'varchar', nullable: true })
  yookassaPaymentId: string;

  @Column({
    type: 'enum',
    enum: PaymentMethodStatus,
    default: PaymentMethodStatus.PENDING,
  })
  status: PaymentMethodStatus;

  @Column({ name: 'bind_transaction_id', nullable: true })
  bindTransactionId: string;

  @OneToMany(() => Transaction, (transaction) => transaction.paymentMethod)
  transactions: Transaction[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
