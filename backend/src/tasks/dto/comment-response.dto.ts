import { TaskComment } from '@prisma/client';
import { UserRefDto, toUserRef } from '../../users/dto/user-response.dto';

export interface CommentDto {
  id: string;
  body: string;
  author: UserRefDto;
  createdAt: string;
  updatedAt: string;
}

export function toCommentDto(comment: TaskComment & { author: Parameters<typeof toUserRef>[0] }): CommentDto {
  return {
    id: comment.id,
    body: comment.body,
    author: toUserRef(comment.author),
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}
