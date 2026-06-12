import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { userAsyncLocalStorage, resolveUserFromHeaders, DEMO_USERS } from '../modules/auth/auth.service';

@Injectable()
export class UserContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const user = resolveUserFromHeaders(req.headers as any);
    if (user) {
      userAsyncLocalStorage.run(user, () => next());
    } else if (req.path.includes('/plans/seed') || req.path.includes('/auth/')) {
      const defaultUser = DEMO_USERS[0];
      userAsyncLocalStorage.run(defaultUser, () => next());
    } else {
      next();
    }
  }
}
