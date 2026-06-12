import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { userAsyncLocalStorage, resolveUserFromHeaders, type CurrentUser } from '../modules/auth/auth.service';

@Injectable()
export class UserContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const user: CurrentUser | null = resolveUserFromHeaders(req.headers as any);
    if (user) {
      userAsyncLocalStorage.run(user, () => next());
    } else {
      next();
    }
  }
}
