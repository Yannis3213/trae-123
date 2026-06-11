import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class AuthService {
  private currentUser: User | null = null;

  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async switchRole(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('用户不存在');
    }
    this.currentUser = user;
    return user;
  }

  getCurrentRole(): User | null {
    return this.currentUser;
  }
}
