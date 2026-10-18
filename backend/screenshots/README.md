# Screenshots Directory — Practical 10

This directory holds test execution and verification screenshots for **Practical 10: Asynchronous Processing with Event-Driven Architecture**.

## Recommended Screenshots to Capture for Lab Submissions:

1. **`01_server_startup.png`**:
   - Terminal window showing `npm start` (or `node server.js`).
   - Confirms `[Events] Event listeners registered successfully (task-created, task-deleted, task-notification-error)`.
   - Confirms `Server running at http://localhost:5000` and `MongoDB connected successfully`.

2. **`02_post_task_immediate_response.png`**:
   - Postman / Thunder Client window executing `POST /tasks`.
   - Response status `201 Created` returned in ~10-15 ms.
   - Shows created task JSON object.

3. **`03_terminal_timestamps_task_created.png`**:
   - Server console demonstrating:
     - `[API] Task saved: <T0>`
     - `[API] Response sent: <T0 + 1ms>`
     - `[Notification] Processing task: ...`
     - `[Notification] Assigned user: Mahek`
     - `[Notification] Completed: <T0 + 2010ms>`
   - Visually proves that HTTP response was delivered to client 2 seconds before notification processing completed.

4. **`04_delete_task_event.png`**:
   - Postman / Thunder Client window executing `DELETE /tasks/:id`.
   - Terminal output showing `[API] Task deleted from DB`, `[API] Delete response sent`, followed by asynchronous notification logging.

5. **`05_safe_error_handling.png`**:
   - Execution demonstrating that errors inside event listeners trigger `[Event Error] Safe error caught` without crashing the Express server.

6. **`06_test_suite_all_pass.png`**:
   - Terminal execution of `npm test` (`node test_events.js`) showing all 15 tests passing.
