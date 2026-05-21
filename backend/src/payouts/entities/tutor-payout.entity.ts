import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from 'src/users/user.entity';

export enum PayoutStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  CANCELED = 'canceled',
  FAILED = 'failed',
}

export enum PayoutMethod {
  BANK_CARD = 'bank_card',
  SBP = 'sbp',
}

@Entity('tutor_payouts')
export class TutorPayout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'tutor_id' })
  tutor: User;

  @Column({ name: 'tutor_id' })
  tutorId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'RUB' })
  currency: string;

  @Column({ type: 'enum', enum: PayoutStatus, default: PayoutStatus.PENDING })
  status: PayoutStatus;

  @Column({ type: 'enum', enum: PayoutMethod })
  method: PayoutMethod;

  @Column({ type: 'varchar', length: 255, name: 'destination_masked' })
  destinationMasked: string;

  @Column({ name: 'yookassa_payout_id', nullable: true, type: 'varchar' })
  yookassaPayoutId: string | null;

  @Column({ name: 'error_message', nullable: true, type: 'text' })
  errorMessage: string | null;

  @Column({ name: 'processed_at', nullable: true, type: 'timestamptz' })
  processedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
