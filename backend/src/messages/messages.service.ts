import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { User } from '../users/user.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import {
  ConversationResponseDto,
  MessageResponseDto,
  toMessageResponseDto,
} from './dto/message-response.dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>
  ) {}

  async sendMessage(senderId: string, dto: CreateMessageDto): Promise<MessageResponseDto> {
    if (dto.receiver_id === senderId) {
      throw new BadRequestException('Cannot send a message to yourself');
    }

    const receiver = await this.usersRepository.findOne({ where: { id: dto.receiver_id } });
    if (!receiver) {
      throw new NotFoundException('Recipient not found');
    }

    const message = this.messagesRepository.create({
      senderId,
      receiverId: dto.receiver_id,
      text: dto.text.trim(),
    });
    const saved = await this.messagesRepository.save(message);
    return toMessageResponseDto(saved);
  }

  /** История переписки с конкретным собеседником; попутно отмечает его сообщения прочитанными. */
  async getThread(
    userId: string,
    otherUserId: string,
    page = 1,
    perPage = 50
  ): Promise<{
    data: MessageResponseDto[];
    pagination: { page: number; per_page: number; total: number };
  }> {
    const otherUser = await this.usersRepository.findOne({ where: { id: otherUserId } });
    if (!otherUser) {
      throw new NotFoundException('Recipient not found');
    }

    const qb = this.messagesRepository
      .createQueryBuilder('message')
      .where(
        '(message.senderId = :userId AND message.receiverId = :otherUserId) OR (message.senderId = :otherUserId AND message.receiverId = :userId)',
        { userId, otherUserId }
      )
      .orderBy('message.createdAt', 'DESC');

    const total = await qb.getCount();
    const rows = await qb
      .skip((page - 1) * perPage)
      .take(perPage)
      .getMany();

    await this.messagesRepository
      .createQueryBuilder()
      .update(Message)
      .set({ readAt: () => 'now()' })
      .where('receiverId = :userId AND senderId = :otherUserId AND readAt IS NULL', {
        userId,
        otherUserId,
      })
      .execute();

    return {
      data: rows.reverse().map(toMessageResponseDto),
      pagination: { page, per_page: perPage, total },
    };
  }

  /** Список диалогов текущего пользователя — по одному последнему сообщению на собеседника. */
  async getConversations(userId: string): Promise<ConversationResponseDto[]> {
    const messages = await this.messagesRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .leftJoinAndSelect('message.receiver', 'receiver')
      .where('message.senderId = :userId OR message.receiverId = :userId', { userId })
      .orderBy('message.createdAt', 'DESC')
      .getMany();

    const byOther = new Map<string, Message[]>();
    for (const m of messages) {
      const otherId = m.senderId === userId ? m.receiverId : m.senderId;
      const list = byOther.get(otherId) ?? [];
      list.push(m);
      byOther.set(otherId, list);
    }

    const conversations: ConversationResponseDto[] = [];
    for (const [otherId, list] of byOther) {
      const last = list[0];
      const other = last.senderId === otherId ? last.sender : last.receiver;
      const unreadCount = list.filter((m) => m.receiverId === userId && !m.readAt).length;
      conversations.push({
        participant: {
          id: other.id,
          name: other.fullName || other.email.split('@')[0],
          avatar_url: other.avatarUrl ?? null,
        },
        last_message: toMessageResponseDto(last),
        unread_count: unreadCount,
      });
    }

    conversations.sort((a, b) => (a.last_message.created_at < b.last_message.created_at ? 1 : -1));
    return conversations;
  }
}
