# Reviews as their own service

<!--
Prompts — delete each as you answer it. Prose, not a template.

WHY A SEAM HERE AT ALL
- Review is a noun, like Chapter is a noun, and Chapter did not get a service.
  What is different about Review? (Who writes it, what makes its model change,
  and whether it must be atomic with the book.)
- What did this boundary cost you, concretely? Count the machinery: a database,
  a Dockerfile, a compose entry, a proxy, a breaker, a pool, a timeout, a
  migration path. Was it worth it, and what would you say to someone who says
  "just add a reviews table to book-service"?

THE MODEL — ids only
- You store bookId and userId and nothing else from other services. A review
  therefore cannot render a name or a title on its own.
- The argument was not simplicity, it was this: a copy needs a way to be
  refreshed, and there are no events yet. Say in your own words why a copy with
  no update path is worse than no copy.
- The book page needs the reviewer's name; the "my reviews" page needs the book
  title. Opposite copies. What does that tell you about solving this by
  denormalising?
- What has to exist before you would hold a copy?

THE DEPENDENCY — soft, on purpose
- POST /reviews accepts a bookId without checking that the book exists. Say
  plainly what that buys and what it costs.
- The numbers, with book-service stopped: POST /books returned 503 in 3.95s;
  POST /reviews returned 201 in 0.03s. Write what those two numbers mean
  together — it is the whole hard-vs-soft argument in one line.
- Availability of POST /reviews is A(review). Had you verified, it would be
  A(review) x A(book). Show the arithmetic for a year at three nines.
- A review can now point at a book that never existed. Where does that get
  cleaned up, and what happens until it does?
- Name the trigger that would make you switch to verifying. Be specific.
- The verify path still exists behind REVIEW_VERIFY_BOOK_EXISTS, for
  measurement. Is a permanent flag honest, or is it a decision you avoided?

THE CONSTRAINT THAT DID TWO JOBS
- Unique (bookId, userId) enforces one review per reader. It also makes a
  duplicate submit return 409 instead of creating a second row — which is why
  this service has no Idempotency-Key, and POST /books does.
- Why did POST /books need a key when this doesn't? What is different about the
  two writes?
- This constraint lives entirely inside one boundary. What would the same rule
  have cost if the two halves lived in different services? (This is the general
  point worth keeping.)

THE SEAM THAT REOPENED
- If the verify flag goes on, review-service must send x-gateway-secret to get
  past book-service. A non-gateway service now needs the "gateway" secret.
- The check was always really "is this an internal caller". Why did the name
  stay accurate for two lessons and stop being accurate now?
- What would you rename it to, and what else would have to change?

WHAT YOU WOULD DO DIFFERENTLY
- If you drew this boundary again from scratch, what would you keep and what
  would you change?
-->
