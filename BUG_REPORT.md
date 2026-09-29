# Bug Report

## BUG-1: Partial Match in Status Filter
- **Severity**: Medium
- **Location**: `task-api/src/services/taskService.js`, function `getByStatus` (Line 9)
- **Root Cause**: The filtering logic uses `String.prototype.includes()` instead of strict equality `===`.
- **Expected vs Actual**: Querying `?status=do` should return exactly 0 tasks if no status strictly equals `'do'`. Instead, it matches `'todo'` and `'done'`. Took me a minute to notice this one — the bug only surfaces with partial strings that happen to be substrings of real status values.
- **Discovered by**: Unit Test: `filters by exact match only` and Integration Test: `filters by status (exact match)`
- **Suggested Fix**: 
  ```javascript
  const getByStatus = (status) => tasks.filter((t) => t.status === status);
  ```

## [FIXED] BUG-2: Pagination Skips First Page
- **Severity**: High
- **Location**: `task-api/src/services/taskService.js`, function `getPaginated` (Line 12)
- **Root Cause**: The offset is calculated by multiplying `page` by `limit`, which operates as a 0-indexed offset while assuming `page` is 1-indexed.
- **Expected vs Actual**: Fetching page 1 with a limit of 10 should return items 0-9. Instead, it computes an offset of `10`, skipping the first page entirely.
- **Discovered by**: Unit Test: `page 1 returns the first limit items`
- **Fix Notes**: Changed the offset formula to `(page - 1) * limit` in the service to align a 1-indexed page with 0-indexed arrays. I also updated the router to clamp `page` and `limit` to their minimum valid values (1 and 10) so negative numbers do not generate invalid offsets.

## BUG-3: Update Overwrites Immutable Fields
**Severity**: High — `task-api/src/services/taskService.js`, `update` function (Line 50)

The method does a blind spread merge: `{ ...tasks[index], ...fields }`. Whatever the client sends in the request body gets merged directly onto the task — no filtering, no allowlist. That means `id` and `createdAt` are fully overwritable by any caller.

Those fields should be immutable after creation. The fix is to strip them out before merging, or only explicitly copy the fields that are actually allowed to change.

- **Discovered by**: Unit Test: `does NOT allow changing id or createdAt`

## BUG-4: completeTask Silently Overwrites Priority
- **Severity**: Low
- **Location**: `task-api/src/services/taskService.js`, function `completeTask` (Line 69)

Wasn't expecting this one. The function hardcodes `priority: 'medium'` in the object it writes back to the task. Completing a task should only set `status` to `done` and stamp `completedAt` — it has no business touching priority. A high-priority task silently becomes medium the moment it's completed.

Fix is one line: remove `priority: 'medium'` from the update payload.

- **Discovered by**: Unit Test: `sets status done and completedAt, keeps original priority`

## BUG-5: Status Filter Ignores Pagination
- **Severity**: Medium
- **Location**: `task-api/src/routes/tasks.js`, function `GET /tasks` (Line 15)
- **Root Cause**: The endpoint checks `if (status)` and returns the filtered tasks instantly, bypassing the subsequent pagination logic.
- **Expected vs Actual**: Using `?status=todo&page=1&limit=5` should return the first 5 todo tasks. Instead, it returns all todo tasks in the system without pagination.
- **Discovered by**: Integration Test: `respects both status and pagination when combined`
- **Suggested Fix**: Apply pagination to the filtered result array instead of returning early, or combine filtering and pagination in the service layer.

## BUG-6: Malformed JSON Triggers 500 Error
- **Severity**: Medium
- **Location**: `task-api/src/app.js`, Express Error Handler Middleware (Line 11)
- **Root Cause**: `express.json()` throws a `SyntaxError` when parsing invalid JSON bodies. The generic error handler catches this and unconditionally emits a 500 status code.
- **Expected vs Actual**: Sending invalid JSON should return a `400 Bad Request` to the client. Instead, it causes a `500 Internal server error`.
- **Discovered by**: Integration Test: `returns 400 for malformed JSON body`
- **Suggested Fix**:
  ```javascript
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON payload' });
  }
  ```

---

## Documentation inconsistencies
- The `README.md` file incorrectly lists the valid task statuses as `pending | in-progress | completed`. However, the API implementation (`validators.js`) and `ASSIGNMENT.md` strictly define the valid statuses as `todo | in_progress | done`.

