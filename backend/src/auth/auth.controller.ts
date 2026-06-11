import { Controller, Post, Get, Body, Headers, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from '../common/dto';
import { JwtGuard } from '../common/guards/jwt.guard';
import * as jwt from 'jsonwebtoken';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  @Get('users')
  @UseGuards(JwtGuard)
  listUsers() {
    return this.authService.listUsers();
  }

  @Get('me')
  me(@Headers('authorization') authHeader: string) {
    if (!authHeader) {
      throw new UnauthorizedException('未提供认证令牌');
    }
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException('认证令牌格式错误');
    }
    try {
      const decoded = jwt.verify(parts[1], 'suitability-system-secret-2024') as any;
      return this.authService.getCurrentUser(decoded.id);
    } catch {
      throw new UnauthorizedException('认证令牌无效或已过期');
    }
  }
}
