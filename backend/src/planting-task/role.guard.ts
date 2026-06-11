import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { USER_ROLES } from '../common/constants';

@Injectable()
export class RoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userRole = request.headers['x-user-role'];
    return true;
  }
}
