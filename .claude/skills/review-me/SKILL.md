---
name: review-me
description: Review the user's recent Claude Code sessions in two dimensions, technical (full-stack) and context engineering / AI workflow, and save the report to .handoffs/reviews/. User-invoked only.
disable-model-invocation: true
context: fork
agent: general-purpose
argument-hint: '[since-last | today | YYYY-MM-DD | YYYY-MM-DD..YYYY-MM-DD]'
---

# Review Me

An open, candid review of how the user worked in recent sessions. Scope: `$ARGUMENTS`
(empty means `since-last`: from when the last review was written until now).

Runs in a forked subagent. Only the final report returns to the main session.

## 1. Gather
- Build the digest: `node .claude/skills/review-me/scripts/digest.mjs <scope>`. It keeps
  user prompts, Claude's replies and one line per tool call. Never read the raw `.jsonl`
  transcripts, they're mostly tool output.
- If the digest prints a `Note:` (e.g. no previous review, so the scope fell back to
  today), put it at the top of the report so the user sees it.
- If the digest says it's large, read it in chunks (redirect to a scratch file, then
  `Read` with offsets) rather than narrowing the scope on your own.
- Read `.claude/user-background-full.md` to calibrate: stack, courses, completion levels.
- Read the newest file in `.handoffs/reviews/`, if any. Its findings are what to follow up.

## 2. Review
Two sections, each grounded in concrete moments from the digest. Quote or paraphrase
the prompt or decision you're judging.

**Technical (full-stack).** Design decisions, questions asked, what the user caught or
missed in Claude's output, and where completion gaps showed (or didn't).

**Context engineering & AI workflow.** Prompt clarity and scoping, plan vs. auto mode
use, rules / skills / hooks / memory hygiene, delegation to subagents, verification
habits, and how corrections were given.

Benchmark both sections in this order of weight:
1. **Against the user's own baseline**: the background and the previous review. What
   grew, what's stuck.
2. **Against the expected level**: if `.claude/skills/review-me/references/rubric.md`
   exists, place the user per axis by its "How to place" rules (junior / mid / senior,
   or beyond senior where the axis defines it) with evidence and a confidence level.
   Without it, skip placement and say the rubric is missing.
3. **How to improve**: concrete steps that close the gaps from 1 and 2, tied to this
   project or the user's courses, not generic advice.

The user directs Claude more than they write code by hand. The digest shows judgment
(specs, catches, pushback), not hands-on craft, so lower confidence on craft-heavy
calls and say so.

Evidence outside the scope can be mentioned, but it doesn't count toward placement.

Be open. No forced positives, no forced negatives. If a dimension had nothing worth
saying, say that in one line.

End with:
- **Since last review**: what changed on the previous findings. Omit it when there's no
  previous review.
- **Next**: 2–3 concrete actions.

## 3. Save and return
- Write the report to `.handoffs/reviews/YYYY-MM-DD.md` (today's date, `mkdir -p` first).
  If the file exists, add `-2`, `-3`.
- First line of the file: `# Review: <from>..<to>`.
- Return the full report as your final message.
