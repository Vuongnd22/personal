import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { toUserDto, UserDto } from './dto/user-response.dto';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(active?: boolean): Promise<UserDto[]> {
    const users = await this.prisma.user.findMany({
      where: active === undefined ? {} : { isActive: active },
      orderBy: { name: 'asc' },
    });
    return users.map(toUserDto);
  }

  async create(dto: CreateUserDto): Promise<UserDto> {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        role: dto.role,
        passwordHash,
      },
    });
    return toUserDto(user);
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser): Promise<UserDto> {
    if (actor.id === id && (dto.isActive === false || (dto.role && dto.role !== 'ADMIN'))) {
      throw new ForbiddenException('Admins cannot deactivate or demote themselves');
    }
    if (dto.name === undefined && dto.role === undefined && dto.isActive === undefined && dto.password === undefined) {
      throw new BadRequestException('No fields to update');
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password !== undefined) data.passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.update({ where: { id }, data });
    return toUserDto(user);
  }
}
