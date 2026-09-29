# Notes & Design Decisions

## `PATCH /tasks/:id/assign`

Here are the design decisions made while implementing the new assignment feature:

1. **Validation Rules & the 100-character Limit**
   - The endpoint strictly requires the `assignee` field to be a non-empty string.
   - A maximum length of 100 characters is enforced. This prevents abuse (e.g. sending megabytes of text) and aligns with reasonable expectations for a user's name or ID.
   - The name is trimmed of leading and trailing whitespace before saving to keep the data clean ("  Trina  " becomes "Trina").

2. **Validate Before 404**
   - Validation of the request body is performed *before* querying the database to see if the task exists. This avoids unnecessary database lookups (or in-memory array scans) for malformed requests, improving performance and adhering to the convention already established in `PUT /tasks/:id`.

3. **Reassignment is Allowed (Overwrite)**
   - If a task is already assigned to someone, issuing a new `PATCH` request allows you to reassign the task to a different user, overwriting the previous assignee. This is highly standard in task management systems.
   - The endpoint is idempotent—assigning it to the same user multiple times just responds with a 200 success without issue.

4. **Preservation of Existing Fields**
   - The assignee update specifically merges the new assignee into the task without modifying existing data. Fields like `status`, `priority`, and `createdAt` are left entirely untouched to prevent scope creep.

---

### What to Test Next
- Test pagination bounds (e.g., negative offsets or extremely high limits). Right now we fallback negative parameters, but we should thoroughly test how the API behaves at the very limits of safe integers.
- Concurrency testing: what happens if two users try to update or complete a task at the exact same moment.

### Surprises in the Codebase
- The Express default error handler defaults to 500 on all upstream errors without inspecting them. This was surprising because `express.json()` legitimately throws `SyntaxError` on malformed JSON bodies. Normally, you expect a 400 Bad Request, but the API returned 500s.
- `getByStatus` used `.includes(status)` instead of strict equality `===`. This means querying for "do" would match both "todo" and "done".
- Pagination offset was calculated as `page * limit`, treating a 1-indexed page as a 0-indexed page and totally skipping the first page of results.
- `update` allowed blindly overwriting immutable fields like `id` and `createdAt`.

### Questions for Production
- How should we authenticate and authorize users? We are assigning a name directly from the body, but in a real app, this should likely be tied to an authenticated user ID.
- Should we decouple the in-memory array to a proper database? How do we handle persisting state across restarts?
- Is there a reason we aren't using a validation library (like Joi, Zod, or class-validator)? Manually writing string and date checks in `validators.js` becomes tedious and error-prone as the API grows.
