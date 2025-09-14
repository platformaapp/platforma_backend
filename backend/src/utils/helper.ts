import { User } from 'src/users/user.entity';

export interface AuthResponse {
  user: Omit<User, 'passwordHash'>;
  access_token: string;
  refresh_token: string;
}
