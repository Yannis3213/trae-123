import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(private readonly dbService: DatabaseService) {}

  async login(username: string, password: string) {
    const user = this.dbService.queryOne(
      'SELECT id, username, display_name, role FROM users WHERE username = ? AND password = ?',
      [username, this.hashPassword(password)],
    ) as any;
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      token: Buffer.from(`${user.id}:${Date.now()}`).toString('base64'),
    };
  }

  async findById(id: string) {
    const user = this.dbService.queryOne(
      'SELECT id, username, display_name, role FROM users WHERE id = ?',
      [id],
    ) as any;
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
    };
  }

  async listUsers() {
    const users = this.dbService.query(
      'SELECT id, username, display_name, role FROM users',
    ) as any[];
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      role: u.role,
    }));
  }

  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }
}
