export type DirectMessageView = {
  id: string;
  senderId: string;
  recipientId: string;
  displayName: string;
  avatarUrl: string | null;
  text: string;
  createdAt: Date;
};

export interface DirectMessageRepository {
  listConversation(userId: string, peerId: string): Promise<DirectMessageView[]>;
  sendMessage(senderId: string, recipientId: string, text: string): Promise<DirectMessageView>;
}
