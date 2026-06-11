import { Controller, Post, Get, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    const result = await this.authService.login(body.username, body.password);
    if (!result) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    return result;
  }

  @Get('current')
  async getCurrentUser(@Headers('x-user-id') userId: string) {
    if (!userId) {
      throw new UnauthorizedException('未提供用户标识');
    }
    const user = await this.authService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    return user;
  }

  @Get('users')
  async listUsers() {
    return this.authService.listUsers();
  }
}
