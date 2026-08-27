export interface AuthRole {
  id: number | string;
  roleName: string;
  [key: string]: unknown;
}

export interface AuthUser {
  id: number | string;
  userName: string;
  userRealname?: string;
  userPic?: string;
  token: string;
  roleList: AuthRole[];
  [key: string]: unknown;
}

export interface PendingAuth {
  token: string;
  user: AuthUser;
}

export interface AuthSession extends PendingAuth {
  role: AuthRole;
}

