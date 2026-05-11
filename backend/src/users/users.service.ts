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
    const users = await this.usersRepository.find({
      select: ['id', 'fullName', 'avatarUrl', 'bio', 'shortBio', 'telegram', 'roles'],
      order: { createdAt: 'DESC' },
    });
    return users.filter((u) => u.roles?.includes('tutor'));
  }
}
