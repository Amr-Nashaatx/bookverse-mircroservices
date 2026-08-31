# Idempotent writes

## Why care about idempotency, what is even the problem?

Well, idempotency is mostly a concern with writes.

Right now let's imagine the situation where a client sends `POST /books`. If the client receives a response with either success or failure, then everything is fine and we have no issue to deal with — you asked for an operation and you got a result back.

But what would happen if the client didn't get any response? Neither success nor failure? Then the first thing that comes to mind is to retry. AND here comes the problem ...

The client didn't receive a response, which could mean it timed out before receiving one. As a result we may have a scenario where:

- there is a delay on the server and actually the server is still working on it ...
- or the server may have performed the operation successfully and written the book, but the response didn't reach the client somehow.

In either case, retrying would create duplicate books.

## How to actually make a write idempotent?

The solution I used here is to make the client mint an `Idempotency-Key` per intent. As long as the server sees the same key, it knows exactly which operation the client is intending.

I did so by adding a new table for keys, and used 2 ideas on the database level:

- First, I use a transaction to create the key before the book, so I don't get partial writes.
- Second, I use a compound key on the new `IdempotencyKey` table on `(ownerUserId, key)`, so each key is scoped per user and is itself identifiable.

Now whenever I get a key conflict on the keys table, I know there is a retry and I act on it.

## Was there a simpler solution?

Yes — actually I could just convert `POST` to `PUT /books/{client-generated-uuid}` and convert the whole operation to an upsert.

But I need the extra data alongside the keys, especially when starting to publish events. A single row won't help much.
