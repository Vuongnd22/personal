import { TaskHistory } from '@prisma/client';
import { UserRefDto, toUserRef } from '../../users/dto/user-response.dto';

export interface HistoryEntryDto {
  id: string;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  actor: UserRefDto;
  createdAt: string;
}

export function toHistoryEntryDto(entry: TaskHistory & { actor: Parameters<typeof toUserRef>[0] }): HistoryEntryDto {
  return {
    id: entry.id,
    action: entry.action,
    field: entry.field,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    actor: toUserRef(entry.actor),
    createdAt: entry.createdAt.toISOString(),
  };
}
