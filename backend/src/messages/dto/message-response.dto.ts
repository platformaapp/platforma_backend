import { Message } from '../entities/message.entity';

export class MessageParticipantDto {
  id: string;
  name: string;
  avatar_url: string | null;
}

export class MessageResponseDto {
  id: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  read_at: string | null;
  created_at: string;
}

export class ConversationResponseDto {
  participant: MessageParticipantDto;
  last_message: MessageResponseDto;
  unread_count: number;
}

export function toMessageResponseDto(message: Message): MessageResponseDto {
  return {
    id: message.id,
    sender_id: message.senderId,
    receiver_id: message.receiverId,
    text: message.text,
    read_at: message.readAt ? message.readAt.toISOString() : null,
    created_at: message.createdAt.toISOString(),
  };
}
