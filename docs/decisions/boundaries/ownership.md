# Who owns which fact

<!--
Prompts — delete each as you answer it. Prose, not a template.

THE MAP ITSELF
- For every domain thing in BookVerse — book, chapter, preview, review, shelf,
  author, notification, user — name the one service allowed to write it.
- Where two services need the same fact, which one owns it and which holds a
  copy? Name the copy as a copy.
- Every copy needs a staleness window in plain words ("wrong for a few seconds
  after a review is posted"). "Eventually consistent" is not an answer.
- Some nouns collapsed into one service. Book, Chapter and Preview are three
  words and one boundary — why? What test did you apply, and what would have to
  change for chapters to deserve their own service?

WHAT YOU FOUND IN YOUR OWN REPO — the part worth writing down
- Nine domain types sat in packages/shared/src/types/. Not one was imported by
  any service. Every service defined its own model instead: a Prisma model for
  storage, a TypeBox schema for the wire. Nobody told them to. Why did that
  happen on its own?
- shared/types/book.types.ts declared averageRating, ratingCount, Genre[] and a
  non-null publishedAt. The real schema had none of those. Four mismatches and
  nothing broke. What does it mean that nothing broke?
- Write the sentence you want to remember about shared domain types. (Mine was
  "a shared type no service implements is not a contract, it's a wish" — find
  your own.)

THE TEST YOU NOW HAVE
- Infrastructure vs business: which shared code do you WANT to change
  everywhere at once, and which belongs to exactly one service?
- Apply it to what's left in @bookverse/shared: errors, ApiResponse, the
  gateway-secret and identity plugins. Why do those pass a test the domain
  types failed?
- The x-user-* header convention is shared by every service, and a change to it
  breaks all of them at once. That is textbook common coupling. Why is it fine?
  (What has to be true for common coupling to be harmless?)

THE POLYSEME
- Book.authorId held a User id, while the domain had a separate Author with a
  pen name and an approval status. One word, two meanings. Why is that the
  strongest boundary signal you can get, and why is it free?
- You renamed it ownerUserId rather than introducing an Author. Say what that
  choice asserts about book-service's model.
- Name the trigger that would make you revisit it — the specific product
  change, not "if it gets complicated".
- The rename changed the API response, so the frontend breaks. You chose that
  over emitting both fields for a window. Why was that the right call HERE, and
  when would it not be?
- Still open: IdempotencyKey.ownerUserId. That column scopes a key to whoever
  sent the request; it does not own anything. Is ownerUserId the right name, or
  did consistency win over accuracy?

THE COST
- What did drawing this map cost you, and what did it buy that a diagram of the
  tables would not have?
- Which entry are you least confident about? Write that one down too — it is
  the one you will revisit.
-->
