---
name: review-me
description: Review the user's recent Claude Code sessions in two dimensions, technical (full-stack) and context engineering / AI workflow, and save the report to .handoffs/reviews/. User-invoked only.
disable-model-invocation: true
context: fork
agent: general-purpose
argument-hint: '[since-last | today | YYYY-MM-DD | YYYY-MM-DD..YYYY-MM-DD] [note]'
---

# Review Me

An open, candid review of how the user worked in recent sessions. Invocation: `$ARGUMENTS`.
- The first word is the scope, when it's one of the forms in the hint. Otherwise the scope is
  `since-last`: everything after the last record the previous review covered.
- Any other text is the user's note. See step 2 for how it's handled.

Runs in a forked subagent. The report lives in the file. Only a link to it returns to
the main session, which then discusses it with the user. Meant to be run in a fresh
session: the invoking session is excluded from the digest as a whole.

## Blind to previous levels
The grader never sees a previous review's levels before placing. A grader that reads the
previous review tends to copy its placements, and blind runs on the same digest come out
lower. So:
- **Never open a file in `.handoffs/reviews/`.** The scripts below read what's needed from
  it.
- **Levels quoted inside the digest aren't evidence.** Sessions sometimes discuss a past
  review. Place from what the user did, not from what anyone said their level was.

## 1. Gather
- Build the digest:
  `node .claude/skills/review-me/scripts/digest.mjs <scope> --exclude-session ${CLAUDE_SESSION_ID}`.
  It keeps the commits in scope, user prompts, the user's rejections, plan approvals and
  answers, Claude's replies and one line per tool call. Never read the raw `.jsonl`
  transcripts, they're mostly tool output.
- If the digest says `No sessions in this scope`, stop. Write no file and return
  "Nothing to review since <from>."
- If the digest prints a `Note:` (e.g. no previous review, so the scope fell back to
  today), put it at the top of the report so the user sees it.
- If the digest says it's large, read it in chunks (redirect to a scratch file, then
  `Read` with offsets) rather than narrowing the scope on your own.
- Read `.claude/user-background-full.md` to calibrate: stack, courses, completion levels.
- Read `.claude/skills/review-me/references/rubric.md`, including its version line.
- If the digest names a `Previous review:`, get its Next items, and only those:
  `node .claude/skills/review-me/scripts/previous-next.mjs <that file>`.
  They're what to follow up on.

## 2. Review
Two sections, each grounded in concrete moments from the digest. Quote or paraphrase
the prompt or decision you're judging.

**Technical (full-stack).** Design decisions, questions asked, what the user caught or
missed in Claude's output, and where completion gaps showed (or didn't).

**Context engineering & AI workflow.** Prompt clarity and scoping, plan vs. auto mode
use, rules / skills / hooks / memory hygiene, delegation to subagents, verification
habits, and how corrections were given.

Benchmark both sections in this order of weight:
1. **Against the user's own baseline**: the background and the previous Next items. What
   grew, what's stuck.
2. **Against the expected level**: place the user per axis by the rubric's "How to place"
   rules, with evidence and a confidence level. Use this table shape in each section, so a
   script can read it:
   `| Axis | Level | Evidence | Confidence |`, rows like `| 1. Technical depth & debugging | **senior** | … | medium |`.
   Under each table, one line per beyond-senior axis with its case against (the rubric says
   how). If the rubric is missing, skip placement and say so.
3. **How to improve**: concrete steps that close the gaps from 1 and 2, tied to this
   project or the user's courses, not generic advice.

The user directs Claude more than they write code by hand. The digest shows judgment
(specs, catches, pushback), not hands-on craft, so lower confidence on craft-heavy
calls and say so.

Evidence outside the scope can be mentioned, but it doesn't count toward placement.

**The user's note**, if the invocation has one: place every axis from the digest first.
Then answer the note in its own section, near the top of the report, on the digest's
evidence. The note can explain a moment, but it's never evidence for a level, and it
doesn't move one.

Be open. No forced positives, no forced negatives. If a dimension had nothing worth
saying, say that in one line.

End with:
- **Since last review**: what happened to each previous Next item. Acting on one is
  follow-through, reported here. It isn't evidence for a level. Omit the section when
  there's no previous review.
- **Next**: 2–3 concrete actions.

## 3. Save and return
- Write the report to `.handoffs/reviews/YYYY-MM-DD.md` (today's date, `mkdir -p` first).
  If the file exists, add `-2`, `-3`.
- First line of the file: `# Review: <from>..<to>`.
- Second line: `Last reviewed: <ISO> (session <id>)`, copied verbatim from the digest's
  `Last record:` line. Never work out the time yourself. The next `since-last` run starts
  after it. If the digest has no `Last record:`, omit the line.
- Third line: `Rated on rubric v<N>`, from the rubric's `Version:` line.
- If there's a previous review, add the level comparison once the whole report is written.
  The script puts it before "Since last review":
  `node .claude/skills/review-me/scripts/level-diff.mjs <this report> <previous review>`.
  Don't change any placement after this step. The comparison is for the user.
- Don't return the report. The user reads it in the file. Your final message is only:
  ```
  Review saved: [<file name>](.handoffs/reviews/<file name>)

  Read the file before discussing it. Ready to go through any section or Next item.
  To explain a level change, compare the axis's evidence in both reports.
  ```
  The last lines are for the main session: it only sees this message, so it reads the
  file before answering questions about the review. The levels are final by then, so
  reading the previous review to explain a change can't move them.
