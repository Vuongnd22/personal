import { TaskAttachment } from '@prisma/client';
import { UserRefDto, toUserRef } from '../../users/dto/user-response.dto';

export interface AttachmentDto {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploader: UserRefDto;
  createdAt: string;
}

export function toAttachmentDto(
  attachment: TaskAttachment & { uploader: Parameters<typeof toUserRef>[0] },
): AttachmentDto {
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    uploader: toUserRef(attachment.uploader),
    createdAt: attachment.createdAt.toISOString(),
  };
}
