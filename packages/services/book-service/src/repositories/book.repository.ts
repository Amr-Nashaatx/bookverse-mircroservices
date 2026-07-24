import prisma from '../lib/prisma.js';
import { Prisma } from '../generated/prisma/index.js';

export const bookRepository = {
    async createBook(data: Prisma.BookCreateInput) {
        return prisma.book.create({ data });
    },

    async findBooks() {
        return prisma.book.findMany({ orderBy: { createdAt: 'desc' } });
    },

    async findBookById(id: string) {
        return prisma.book.findUnique({ where: { id } });
    },

    async updateBook(id: string, update: Prisma.BookUpdateInput) {
        return prisma.book.update({ where: { id }, data: update });
    },

    async deleteBook(id: string) {
        return prisma.book.delete({ where: { id } });
    },
};
