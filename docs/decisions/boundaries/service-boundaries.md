## Who owns which fact

BookVerse has different domains - book, chapter, preview, review ...etc. While at the moment of writing this most of these are non existent but i try to make things explicit from now on. Every fact should only be writable by one service, every other service that needs that value simply takes a copy with an estimated staleness-window e.g(few sconds or few minutes).
For example book-service might need an averageRating field, which depends on the list of reviews on that book. That list lives in review-service and we only allow the review-service to own that list so book-service holds a copy of some sort which goes stale whenever reviews change, this is where we declare a staleness window for the reviews.

## Where to draw the seam?

There are four questions that should be asked at the design step.

### Q1-Who writes it?

Two service can not own the same fact, only one should own it, if they must both own it then you may be drawing a wrong boundary so consider the other following questions.

### Q2-What changes together?

A boundary or separation between two processes comes at a cost of network calls can hanging, two writes half-happen and a join between data is no longer cheap as the data no longer lives on the same database which incurs network round-trips.
This is a huge cost to pay unless we reap the benefits of independence.
That is all big talk but what is that saying is imagine having two services unless we can deploy and scale them totally separately and failures in one doesn't bring down the other then why doing it?
we are paying the cost for nothing in return, so if a change in process of service A affects service B we clearly losing those benefits we can no longer deploy A without a redeploy of B, a failure in A brings down B, and B is affected by the scale of A either up and down.

### Q3-What must be atomic?

Suppose we have a process that does two atomic writes to two different pieces of data so they both either success or fail together. before we divide it into two we should consider what happens after each side holds a part of the data? Is this operation would be valid if the first write happened and the second got delayed? if no it does not mean we can't divide them but it would be at a cost that must be considered.

### Q4-Where does the language change?

When the same word means two different things, the seam runs between the two meanings. what does this mean? suppose we have an e-commerce the word "order" when talking payment is totally different when talking about delivery, so this is a sign a seam can be drawn and each side has its definition of "order" and both agrees only at the edges.

Again those are guidelines for me because i am starting to add more services and domains into the project, the most recent is the review-service it was a simple case and obvious but it won't be for domains like chapter or preview later.

Now let's start talking after we have drawn the line and have two sides or services A and B, in a typical system it is normal for services to depend on each other but there is a grading to this dependency or we could say "Coupling". the worse the coupling the more benefits we lose, the two worst types of couplings we should avoid are what are called common coupling and content coupling, the latter is the worst and it mean service A reach into the state of B changing it -for example write into B's database directly.
this what turns a system into "distributed monolith".
As for common coupling it means: A and B share a resource: a database, a file — or a domain type library.
Does it mean shared libraries are bad? not if a change in this shared code is only due to infrastructure only. A change that happens for business reasons in the shared code is means both A and B should change so we are losing independence here.

I actually was about to hit the common coupling before i add anything, when i started this repo i added shared types like Book, Review and so on that i intended to be used by all services, this was a terrible idea and a terrible design so i removed them entirely, but i kept things like API responses, errors and authentication plugins because they define the platform behavior and it should affect all services.
