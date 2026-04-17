# Submission

## Coverage

31/31 tests passing
Overall coverage: 92.71% statements, 82.95% branches, 93.1% functions

-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-----------------|---------|----------|---------|---------|-------------------
All files        |   92.71 |    82.95 |    93.1 |   91.97 |                   
 src             |   69.23 |       75 |       0 |   69.23 |                   
  app.js         |   69.23 |       75 |       0 |   69.23 | 10-11,17-18       
 src/routes      |   98.07 |    88.46 |     100 |   98.07 |                   
  tasks.js       |   98.07 |    88.46 |     100 |   98.07 | 43                
 src/services    |   98.41 |    91.66 |     100 |   97.95 |                   
  taskService.js |   98.41 |    91.66 |     100 |   97.95 | 83                
 src/utils       |   78.26 |    73.52 |     100 |   78.26 |                   
  validators.js  |   78.26 |    73.52 |     100 |   78.26 | 15,22,25,28,31    
-----------------|---------|----------|---------|---------|-------------------

---

## Bug Report

### Bug 1 — `getByStatus` uses substring match instead of strict equality

**File:** `src/services/taskService.js`

**Expected behavior:** `getByStatus('todo')` should return only tasks whose status is exactly `'todo'`.

**Actual behavior:** Uses `String.prototype.includes()` so searching for `'in'` returns all `in_progress` tasks. Any substring of a valid status would return unintended results.

**How discovered:** Wrote a test asserting that filtering by `'in'` returns 0 results. It returned 1.

**Fix:**
```js
// before
const getByStatus = (status) => tasks.filter((t) => t.status.includes(status));

// after
const getByStatus = (status) => tasks.filter((t) => t.status === status);
```

---

### Bug 2 — `getPaginated` uses wrong offset formula (off-by-one)

**File:** `src/services/taskService.js`

**Expected behavior:** Page 1 with limit 2 should return items 1 and 2.

**Actual behavior:** Offset is calculated as `page * limit` instead of `(page - 1) * limit`. So page 1 skips the first 2 items and returns items 3 and 4 instead.

**How discovered:** Wrote a test asserting `getPaginated(1, 2)` returns the first task. It returned the third.

**Fix:**
```js
// before
const offset = page * limit;

// after
const offset = (page - 1) * limit;
```

---

### Bug 3 — `completeTask` forcefully resets priority to `'medium'`

**File:** `src/services/taskService.js`

**Expected behavior:** Marking a task as complete should set `status` to `'done'` and set `completedAt`. It should not touch any other fields.

**Actual behavior:** The function hardcodes `priority: 'medium'` in the updated object, which overwrites the task's original priority regardless of what it was.

**How discovered:** Created a task with `priority: 'high'`, called `completeTask`, and asserted priority was still `'high'`. It came back as `'medium'`.

**Fix:**
```js
// before
const updated = {
  ...task,
  priority: 'medium',
  status: 'done',
  completedAt: new Date().toISOString(),
};

// after
const updated = {
  ...task,
  status: 'done',
  completedAt: new Date().toISOString(),
};
```

---

## What I fixed

Fixed all three bugs above. Updated the tests to assert the now-correct behavior.

---

## New Feature — `PATCH /tasks/:id/assign`

Added a new endpoint that accepts an `assignee` name as a string and stores it on the task.

**Validation:**
- Returns `400` if `assignee` is missing, is not a string or an empty/whitespace-only string
- Returns `404` if the task does not exist
- Trims leading/trailing whitespace from the assignee name before storing

**Implementation:**
- Added `assignTask(id, assignee)` in `taskService.js`
- Added the route in `src/routes/tasks.js`
- Wrote 5 tests covering happy path, empty string, missing field, 404, and whitespace trimming

---

## What I'd test next

- What happens when `dueDate` is set to a past date on creation — currently valid, but arguably worth a warning or validation.
- The `PUT` update endpoint accepts any fields including `id` and `createdAt` — no field filtering. A malicious user could overwrite the task's ID.
- Edge cases on pagination — page 0, negative page numbers, limit larger than total tasks.

---

## What surprised me

The `completeTask` bug was the most interesting one — resetting priority to `'medium'` on completion feels like it was intentional at some point (maybe "done tasks don't need priority") but was never communicated through validation or documentation. It silently destroys data in a way that's hard to notice without tests.

The `includes()` bug in `getByStatus` is a classic — looks completely reasonable at a glance, passes a happy path test, and only breaks on partial string input which nobody thinks to test manually.

---

## Questions before shipping to production

- **Persistence:** The in-memory store resets on every server restart. What's the target database? Schema migrations need to be planned especially around `assignee` being added after the fact.
- **Authentication:** There's no auth layer. Any user can update or delete any task. Is this a single-user tool or multi-tenant?
- **Input size limits:** No limit on title or description length. A client could send a megabyte string and it gets stored in memory.