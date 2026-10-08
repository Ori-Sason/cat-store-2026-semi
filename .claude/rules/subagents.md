# Subagents

The main session's context is for decisions and implementation. Research goes to subagents.

## Research
- Delegate research to a subagent by default, even when not asked. This covers library and tool
  comparisons, version, maintenance and security checks, web and docs digging, and hands-on
  probes such as scratch builds or bundle-size measurements.
- Follow-ups on a delegated question ("dig deeper", "compare X and Y") go back to the same
  agent via SendMessage. It keeps its context, and the main session stays clean.
- Before spawning, ask the user the questions that change the research's scope.
- Research inline only when the user asks for it, or for a quick lookup that's part of the
  current task, such as one context7 query while implementing.

## Briefs
The agent sees only what it's sent, never the main session's chat or later messages.
- Every brief, research or review, lists decisions already made and options ruled out
  ("decided against: …"). Otherwise the agent suggests them again.
- A follow-up includes what changed since its report: the user's answers, new constraints,
  options ruled out, the current leaning.
