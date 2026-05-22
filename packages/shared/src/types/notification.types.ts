export interface INotification {
  recipientId: string;
  title: string;
  message: string;
  actionUrl?: string;
  metadata: Record<string, unknown>;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
