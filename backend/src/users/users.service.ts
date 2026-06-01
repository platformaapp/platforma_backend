import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>
  ) {}

  async findAll(): Promise<Partial<User>[]> {
    return await this.usersRepository.find({
      select: [
        'id',
        'email',
        'fullName',
        'roles',
        'phone',
        'telegram',
        'avatarUrl',
        'bio',
        'shortBio',
        'createdAt',
        'updatedAt',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async findTutors(): Promise<Partial<User>[]> {
    return await this.usersRepository
      .createQueryBuilder('user')
      .innerJoin(
        'tutor_applications',
        'app',
        'app.user_id = user.id AND app.status = :status',
        { status: 'approved' },
      )
      .select([
        'user.id',
        'user.fullName',
        'user.avatarUrl',
        'user.bio',
        'user.shortBio',
        'user.telegram',
        'user.roles',
      ])
      .where('user.is_blocked = false')
      .orderBy('user.created_at', 'DESC')
      .getMany();
  }
}
