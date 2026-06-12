import { UserRole } from '@prisma/client';

export interface UserEntity {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isVerified: boolean;
}
