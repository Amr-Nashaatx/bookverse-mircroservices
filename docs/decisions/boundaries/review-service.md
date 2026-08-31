# Reviews as their own service

The only significant design choice here is whether to check existence of book when creating review. adding this existence check adds a hard dependency on book service, a hard dependency causes latency of review creation to be as good as the latency of book serivce, it also affects the service availability as it would be bound to the availability of the book service, so in this case i chose to make the dependency soft, i simply trust the book exists and i will reconcile later when i start adding events, having orphaned reviews for some time is not an issue.
