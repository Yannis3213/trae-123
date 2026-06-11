import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  constructor(private dbService: DatabaseService) {}

  login(username: string, password: string): { token: string; user: any } {
    const db = this.dbService.getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role },
      'suitability-system-secret-2024',
      { expiresIn: '24h' }
    );
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    };
  }

  listUsers() {
    const db = this.dbService.getDb();
    return db.prepare('SELECT id, username, name, role FROM users ORDER BY id').all();
  }

  getCurrentUser(userId: number) {
    const db = this.dbService.getDb();
    const user = db.prepare('SELECT id, username, name, role, created_at FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    return user;
  }
}
