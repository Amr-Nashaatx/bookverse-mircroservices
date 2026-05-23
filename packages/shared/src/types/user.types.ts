export type UserRole = 'user' | 'admin' | 'author';

export interface UserPublic {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatar?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface User extends UserPublic {
    password: string;
}
