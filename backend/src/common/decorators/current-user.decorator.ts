import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return {
      id: request.headers['x-user-id'],
      name: request.headers['x-user-name'],
      role: request.headers['x-user-role'],
    };
  },
);
