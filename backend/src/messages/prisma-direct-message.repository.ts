import type { PrismaClient } from '@prisma/client';
import type { DirectMessageRepository, DirectMessageView } from './direct-message.types.js';

export class PrismaDirectMessageRepository implements DirectMessageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listConversation(userId: string, peerId: string): Promise<DirectMessageView[]> {
    const messages = (await this.prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: userId, recipientId: peerId },
          { senderId: peerId, recipientId: userId },
        ],
      },
      include: { sender: { select: { displayName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })).reverse();
    return messages.map(message => ({
      id: message.id,
      senderId: message.senderId,
      recipientId: message.recipientId,
      displayName: message.sender.displayName,
      avatarUrl: message.sender.avatarUrl,
      text: message.body,
      createdAt: message.createdAt,
    }));
  }

  async sendMessage(senderId: string, recipientId: string, text: string): Promise<DirectMessageView> {
    const message = await this.prisma.directMessage.create({
      data: { senderId, recipientId, body: text },
      include: { sender: { select: { displayName: true, avatarUrl: true } } },
    });
    return {
      id: message.id,
      senderId: message.senderId,
      recipientId: message.recipientId,
      displayName: message.sender.displayName,
      avatarUrl: message.sender.avatarUrl,
      text: message.body,
      createdAt: message.createdAt,
    };
  }
}
