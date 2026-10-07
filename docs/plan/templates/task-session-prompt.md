# Starting a task session

Paste into Claude Code (replace the task id):

```
Read CLAUDE.md and docs/plan/README.md. Work task T1.2 from docs/plan/01-security-and-hygiene.md.
Follow its Steps in order, run every command in its "Done when", and fix anything that fails.
For UI changes, check the result in the Browser pane at 375×812 and describe what you saw.
When done: set the task's Status line to "done (YYYY-MM-DD)", update the phase status in docs/plan/README.md if the phase is complete, and commit with message "<type>(<scope>): T1.2 <summary>".
Stop and ask me only for steps marked MANUAL (James); prepare the exact values or commands I need.
```

Variants:

- **Start a whole phase:** "Work the next `todo` task in docs/plan/0X-….md, then continue to the following task in the same session if it is small; stop after at most three tasks or when a MANUAL step is reached."
- **Resume:** "Task T6.3 is `in-progress`. Read its file and the last commit touching it (`git log -3 --oneline`), then continue."
- **Review a task:** "Review the last commit for task T4.5 against its Done-when list; report gaps, don't fix."
