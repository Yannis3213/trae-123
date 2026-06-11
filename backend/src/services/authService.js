const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { JWT_SECRET, JWT_EXPIRES_IN, ROLES, ROLE_NAMES, STATUS, STATUS_NAMES } = require('../config');
const { UserModel } = require('../models');

class AuthService {
  static async login(username, password) {
    const user = UserModel.findByUsername(username);
    if (!user) {
      return { success: false, message: '用户名或密码错误' };
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return { success: false, message: '用户名或密码错误' };
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          roleName: ROLE_NAMES[user.role],
          department: user.department
        }
      }
    };
  }

  static getCurrentUser(userId) {
    const user = UserModel.findById(userId);
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      roleName: ROLE_NAMES[user.role],
      department: user.department
    };
  }

  static listUsers() {
    return UserModel.findAll().map(u => ({
      ...u,
      roleName: ROLE_NAMES[u.role]
    }));
  }

  static listUsersByRole(role) {
    return UserModel.findByRole(role).map(u => ({
      ...u,
      roleName: ROLE_NAMES[u.role]
    }));
  }
}

module.exports = AuthService;
