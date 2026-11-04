import { Role, User } from '@prisma/client';

export interface UserRefDto {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
}

export interface UserDto extends UserRefDto {
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export function toUserRef(user: User): UserRefDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarColor: user.avatarColor,
  };
}

export function toUserDto(user: User): UserDto {
  return {
    ...toUserRef(user),
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}
