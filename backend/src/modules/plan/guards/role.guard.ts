import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const requiredRole = Reflect.getMetadata('role', context.getHandler());
    if (!requiredRole) return true;

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      throw new HttpException('未登录', HttpStatus.UNAUTHORIZED);
    }

    if (currentUser.role !== requiredRole && requiredRole !== 'any') {
      throw new HttpException(
        `越权操作：当前角色${currentUser.role}无权执行此操作，需要${requiredRole}角色`,
        HttpStatus.FORBIDDEN,
      );
    }

    request.currentUser = currentUser;
    return true;
  }
}
