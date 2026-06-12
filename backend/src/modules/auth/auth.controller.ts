import { Controller, Post, Get, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: { username: string }) {
    const user = this.authService.login(body.username);
    if (!user) return { code: 401, message: '用户不存在', data: null };
    return { code: 0, message: '登录成功', data: user };
  }

  @Post('switch-role')
  switchRole(@Body() body: { role: string }) {
    const user = this.authService.switchRole(body.role);
    if (!user) return { code: 400, message: '角色不存在', data: null };
    return { code: 0, message: '切换成功', data: user };
  }

  @Get('current')
  getCurrentUser() {
    return { code: 0, message: 'ok', data: this.authService.getCurrentUser() };
  }

  @Get('users')
  getAllUsers() {
    return { code: 0, message: 'ok', data: this.authService.getAllUsers() };
  }
}
