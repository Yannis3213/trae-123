import { Controller, Post, Get, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('switch-role')
  async switchRole(@Body() body: { userId: string }) {
    const user = await this.authService.switchRole(body.userId);
    return { success: true, data: user };
  }

  @Get('current-role')
  getCurrentRole() {
    const user = this.authService.getCurrentRole();
    return { success: true, data: user };
  }
}
