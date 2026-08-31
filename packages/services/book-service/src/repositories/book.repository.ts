import prisma from '../lib/prisma.js';
import { Prisma } from '../generated/prisma/index.js';

interface CreateBookWithKeyInput extends Prisma.BookCreateInput {
    idempKey: string;
    requestHash: string;
}
export const bookRepository = {
    async createBook(data: CreateBookWithKeyInput) {
        return await prisma.$transaction(async (tx) => {
            const { idempKey, requestHash, ...bookData } = data;
            await tx.idempotencyKey.create({
                data: { ownerUserId: data.ownerUserId, key: idempKey, requestHash: requestHash },
            });

            const book = await tx.book.create({ data: bookData });

            await tx.idempotencyKey.update({
                where: { ownerUserId_key: { ownerUserId: data.ownerUserId, key: data.idempKey } },
                data: { bookId: book.id },
            });

            return book;
        });
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
