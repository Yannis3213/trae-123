import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { UsersService } from '../users/users.service';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly usersService: UsersService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) {
      req.user = null;
      return next();
    }
    try {
      const userId = parseInt(token, 10);
      if (!isNaN(userId)) {
        const user = await this.usersService.findOne(userId);
        req.user = user;
      }
    } catch (e) {
      req.user = null;
    }
    next();
  }
}
