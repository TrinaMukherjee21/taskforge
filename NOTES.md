# Notes & Design Decisions

## Test Coverage

Run on 2026-09-29 with `npm run coverage` inside `task-api/`.

```
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-----------------|---------|----------|---------|---------|-------------------
All files        |    97.5 |    93.47 |   96.66 |   98.61 |                   
 src             |   84.61 |       75 |      50 |   84.61 |                   
  app.js         |   84.61 |       75 |      50 |   84.61 | 17-18             
 src/routes      |   96.42 |    85.71 |     100 |     100 |                   
  tasks.js       |   96.42 |    85.71 |     100 |     100 | 20-23             
 src/services    |     100 |    94.73 |     100 |     100 |                   
  taskService.js |     100 |    94.73 |     100 |     100 | 22                
 src/utils       |     100 |      100 |     100 |     100 |                   
  validators.js  |     100 |      100 |     100 |     100 |                   
-----------------|---------|----------|---------|---------|-------------------
Test Suites: 3 passed, 3 total | Tests: 61 passed, 61 total | Time: 20.878s
```

---

## `PATCH /tasks/:id/assign`

Design decisions made while implementing the assignment feature:

1. **Validation Rules & the 100-character Limit**
   - The endpoint strictly requires `assignee` to be a non-empty string.
   - A max length of 100 characters is enforced to prevent abuse (e.g. someone sending megabytes of text). 100 chars is a reasonable ceiling for any realistic name or user ID.
   - The value is trimmed before saving — `"  Trina  "` becomes `"Trina"`.

2. **Validate Before 404**
   - Input validation runs before the task lookup. No point doing a DB scan if the request body is already malformed. `PUT /tasks/:id` already follows this pattern, so staying consistent felt right.

3. **Reassignment is Allowed (Overwrite)**
   - If a task is already assigned, a new `PATCH` just overwrites the existing assignee. I figured reassignment should just work like most task trackers I've used — no need to unassign first, no special-casing required.
   - The endpoint is idempotent: assigning the same user twice returns 200 without any issue.

4. **Preservation of Existing Fields**
   - The update merges only the `assignee` field. `status`, `priority`, `createdAt` — none of that gets touched. Kept the scope tight intentionally, especially after seeing BUG-3.

---

### What to Test Next
- Pagination bounds (negative offsets, extremely high limits). We clamp negatives now, but behavior at integer extremes is still untested.
- Concurrency: what happens if two requests try to update the same task simultaneously? Not a real concern with an in-memory store, but worth keeping in mind if this moves to a real DB.

### Surprises in the Codebase
- The Express error handler defaults to 500 on everything — including `SyntaxError` from `express.json()`. You'd expect a 400 on malformed JSON, but nope, 500.
- `getByStatus` used `.includes(status)` instead of `===`. Querying `"do"` would silently match both `"todo"` and `"done"`.
- Pagination offset was `page * limit`, treating 1-indexed pages as 0-indexed — so page 1 would skip everything and start at item 11.
- `update` did a blind object spread. You could overwrite `id` or `createdAt` without getting any error back.

### Questions for Production
- Authentication/authorization — assignee is just free-text from the request body right now. In a real app this should be tied to an authenticated user identity.
- Persistence — the in-memory array resets on every restart. Is there a plan to wire in a database?
- Validation library — manually writing string and date checks in `validators.js` gets tedious fast. Zod or Joi would clean this up considerably as the API grows.

