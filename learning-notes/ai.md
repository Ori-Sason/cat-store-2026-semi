* **Agent or main session?**  
  * **Research where I want the conclusion** → spawn an agent. Keeps installs, builds and big outputs out of the main session.
  * **Going deeper on the same topic** → continue that agent rather than spawning a new one. It already has the sources and numbers. Pass along anything decided since it reported.
  * **Research I want to steer, or that feeds straight into a decision we're making together** → main session. I see each step and can redirect.
  * **A deliberately independent opinion** → new agent, without the first one's framing.

  **Note:** Claude only uses a sub-agent when asked, and a request covers that task only. Ask again for each new task. For a standing default, say so explicitly ("for the rest of this session…"), or put it in CLAUDE.md, a rule, or a saved memory.