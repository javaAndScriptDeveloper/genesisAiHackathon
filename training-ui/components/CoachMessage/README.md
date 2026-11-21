# CoachMessage

An AI coach message in chat or as a recommendation card: decision, reason from the data, action.

**Markup:** `.ds-coach` > `.ds-coach__avatar` (a neutral pulse icon in `coach`, no name or face) + `.ds-coach__bubble` > `__who`, `__text` (`body-l`), `__why` (the reason, `ink-muted`, with a rule above), `__actions`. Typing — `.ds-coach__typing`. User reply — `.ds-user-msg`.

**Consumer provides:** the decision text, an explanation with concrete numbers from the user's data, actions (up to two buttons), the streaming state.

- Every plan change has a `__why` with the metrics it follows from. Without data the coach asks instead of deciding.
- `primary` inside the bubble only when the recommendation changes the plan; otherwise no buttons.
- Don't: sparkles/gradients as an “AI marker”, made-up numbers, medical diagnoses.
