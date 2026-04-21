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

  async findAll(): Promise<User[]> {
    return await this.usersRepository.find({
      select: [
        'id',
        'email',
        'fullName',
        'roles',
        'phone',
        'avatarUrl',
        'bio',
        'createdAt',
        'updatedAt',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async findTutors(): Promise<Partial<User>[]> {
    return await this.usersRepository
      .createQueryBuilder('user')
      .select(['user.id', 'user.fullName', 'user.avatarUrl', 'user.bio', 'user.roles'])
      .where("'tutor' = ANY(string_to_array(user.roles, ','))")
      .orderBy('user.createdAt', 'DESC')
      .getMany();
  }
}
