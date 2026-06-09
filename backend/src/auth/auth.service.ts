import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByUsername(dto.username);
    if (!user || user.password !== dto.password) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      token: String(user.id),
    };
  }
}
