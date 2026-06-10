import * as userRepo from "../repositories/userRepository.js";
import type { User } from "../types/index.js";

export function login(username: string, password: string): Omit<User, "password"> | null {
  const user = userRepo.findByUsername(username);
  if (!user) return null;
  if (user.password !== password) return null;
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

export function getCurrentUser(userId: string): Omit<User, "password"> | null {
  const user = userRepo.findById(userId);
  if (!user) return null;
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}
