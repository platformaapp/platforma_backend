import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session, SessionStatus } from './entities/session.entity';
import { User } from '../users/user.entity';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private sessionsRepository: Repository<Session>,
    @InjectRepository(User)
    private usersRepository: Repository<User>
  ) {}

  async createSession(
    tutorId: string,
    studentId: string,
    startTime: Date,
    endTime: Date,
    price: number
  ): Promise<Session> {
    const tutor = await this.usersRepository.findOne({ where: { id: tutorId } });
    const student = await this.usersRepository.findOne({ where: { id: studentId } });

    if (!tutor || !student) {
      throw new NotFoundException('Tutor or student not found');
    }

    const session = this.sessionsRepository.create({
      tutor,
      student,
      startTime,
      endTime,
      price,
    });

    return await this.sessionsRepository.save(session);
  }

  async findById(sessionId: string): Promise<Session> {
    const session = await this.sessionsRepository.findOne({
      where: { id: sessionId },
      relations: ['tutor', 'student'],
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  async updateSessionPayment(sessionId: string, paymentId: string): Promise<Session> {
    const session = await this.findById(sessionId);
    session.paymentId = paymentId;
    session.status = SessionStatus.CONFIRMED;

    return await this.sessionsRepository.save(session);
  }
}
