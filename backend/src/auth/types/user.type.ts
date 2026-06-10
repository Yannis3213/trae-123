import { UserRole } from '../../common/enums/user-role.enum';

export interface UserType {
  id: number;
  username: string;
  role: UserRole;
  name: string;
}
