import { Injectable } from '@nestjs/common';
import { PrismaService } from '@spotify/prisma';
import { UserEntity } from './user.entity';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }
}
