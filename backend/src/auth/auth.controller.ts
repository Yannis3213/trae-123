import { Controller, Post, Get, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
import { UserType } from './types/user.type';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  private readonly mockUsers: UserType[] = [
    { id: 1, username: 'registrar', name: '团购登记员', role: UserRole.GROUPON_REGISTRAR },
    { id: 2, username: 'auditor', name: '审计主管', role: UserRole.AUDIT_SUPERVISOR },
    { id: 3, username: 'reviewer', name: '复核组长', role: UserRole.REVIEW_LEADER },
    { id: 4, username: 'operator', name: '团长运营', role: UserRole.LEADER_OPERATOR },
    { id: 5, username: 'specialist', name: '履约专员', role: UserRole.FULFILLMENT_SPECIALIST },
    { id: 6, username: 'manager', name: '城市经理', role: UserRole.CITY_MANAGER },
  ];

  @Post('login')
  @ApiOperation({ summary: '模拟登录' })
  @ApiResponse({ status: 200, description: '登录成功，返回用户信息' })
  login(@Body() loginDto: LoginDto) {
    const user = this.mockUsers.find((u) => u.username === loginDto.username);
    if (!user) {
      return {
        success: false,
        message: '用户名或密码错误',
      };
    }
    return {
      success: true,
      data: user,
      message: '登录成功',
    };
  }

  @Get('users')
  @ApiOperation({ summary: '获取可用用户列表' })
  @ApiResponse({ status: 200, description: '返回所有可用用户' })
  getUsers() {
    return {
      success: true,
      data: this.mockUsers,
    };
  }
}
