import prisma from '../lib/prisma.js';
import { Prisma } from '../generated/prisma/index.js';

export const authRepository = {
    async createUser(data: Prisma.UserCreateInput) {
        return prisma.user.create({ data });
    },

    async findUserByEmail(email: string) {
        return prisma.user.findUnique({ where: { email } });
    },

    async findUserById(id: string) {
        return prisma.user.findUnique({ where: { id } });
    },

    async createSession(data: Prisma.SessionCreateInput) {
        return prisma.session.create({ data });
    },
    async findSessionByUserId(userId: string) {
        return prisma.session.findMany({ where: { userId } });
    },
    async findSessionById(id: string) {
        return prisma.session.findUnique({ where: { id } });
    },

    async updateSession(id: string, update: Prisma.SessionUpdateInput) {
        return prisma.session.update({ where: { id }, data: update });
    },
    async deleteSession(id: string) {
        return prisma.session.delete({ where: { id } });
    },

    async deleteAllUserSessions(userId: string) {
        const { count } = await prisma.session.deleteMany({ where: { userId } });
        return count;
    },
};
