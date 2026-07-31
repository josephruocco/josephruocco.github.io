---
layout: post
title: "Returning Less, On Purpose"
subtitle: "I built a docs retriever that answers 100% of my test questions in 678 tokens. The naive version needs 2,655."
date: 2026-07-31
type: essay
---

I built a documentation retrieval tool that answers 100% of my test questions in
678 tokens. The naive version answers the same 100% in 2,655. The interesting
number isn't the 74% saving. It's that I had to build a metric that punishes
retrieval for succeeding too hard, or I never would have found the difference.

## The setup

PostHog's docs are good. That isn't the problem. The problem is what happens
when an AI coding agent needs them.

A developer types "how do I capture a custom event with PostHog in React?" into
Cursor. The agent has three options. It can guess from training data, which
ages badly. It can read the whole docs site, which doesn't fit. Or something can
retrieve the relevant parts and paste them into its context window.

Almost everyone builds the third option the same way: chunk the docs, index
them, return the top five matches. It takes an afternoon. It mostly works. And
it is worse than it looks, in a way that ordinary metrics are structurally
incapable of showing you.

So I built the afternoon version, then built an eval to attack it.

## What a raw dump actually contains

Scored against a hand-labelled ground truth of 28 questions, the top-5 dump
averages:

- 2,655 tokens
- 61% precision — nearly 40% of the cited docs don't answer the question
- 1.14 wrong sources dragged in per question

And a 100% hit rate. Every single question had a correct doc somewhere in the
pile.

That last number is the trap. Hit rate is maximised by returning everything. Any
metric that only rewards finding the answer will call a system that returns the
entire index flawless, right up until an agent reads the Ruby snippet, the React
snippet, and the vanilla-JS snippet, and writes something that is all three.

The docs make this worse for an admirable reason. PostHog composes their MDX
from shared `_snippets/` fragments, so one edit propagates everywhere — which
means the same install block genuinely appears in five pages. Retrieval sees
five strong matches and reports five. To an agent that isn't corroboration. It's
one fact and four wasted passages, and the repetition reads as emphasis.

## The metric that found the bug

So I added restraint.

Fourteen of my 28 cases are labelled `single_source: true`. These are questions
narrow enough that exactly one doc answers them completely — "what's the
difference between `set` and `set_once`?", "how do I pin the snippet version?".
On those cases I don't measure whether the right doc appeared. I measure whether
the right doc appeared *alone*. Bringing a second source is a failure, even
though it costs nothing in hit rate and might even help precision.

The naive top-5 dump scores **21%** on restraint.

That is the number the whole project exists to expose. A system that looks
perfect on hit rate and respectable on precision is, four times out of five,
unable to shut up when it already has the answer.

## What the assembler does

`how_do_i(task, token_budget)` is seven steps, and only the first one adds
anything:

1. **Retrieve wide.** 24 candidates. Cheap.
2. **Re-score for task fit.** BM25 measures lexical overlap. It has no idea
   whether a passage contains runnable code, targets the framework you named,
   or costs 900 tokens to say one thing.
3. **Cut the long tail.** Anything below 42% of the top passage's value is gone.
   Leftover budget is not an obligation to fill it.
4. **Deduplicate.** Identical code blocks with different prose — the shared
   snippet case. High word overlap with different code — the same explanation
   rewritten per framework.
5. **Cap sources.** Four docs, maximum. Past that an agent is reading
   documentation instead of writing code.
6. **Budget.** Fill in value order, so the best passage is never the one cut.
7. **Order and cite.** Install, then API, then example. An agent reads top-down
   and acts on the first actionable thing; if the example precedes the setup, it
   writes code against an uninitialised SDK.

Result: precision 61% → 88%, restraint 21% → 86%, wrong sources 1.14 → 0.29,
context 2,655 → 678 tokens. Hit rate stays at 100%.

I also ran a third config I'd recommend to anyone doing this comparison: the
naive ranking, truncated at the same 800-token ceiling. Without it, someone
reasonably objects that I only won because I was allowed to stop. That config
gets down to 461 tokens — smaller than mine — and pays for it by dropping to a
**79% hit rate**. It's cheaper because it truncates mid-answer. Cheap and wrong
isn't a win, but pretending it wasn't cheaper would be dishonest.

## Four bugs that were invisible from the outside

Every one of these produced output that looked completely fine.

**The docs were mostly empty.** PostHog's MDX is componentized. The "Capturing
events" section of `libraries/js/usage.mdx` is, on disk, an `import` statement
and `<WebSendEvents />`. Treat those files as plain markdown — as any reasonable
loader would — and you index empty sections for precisely the content
developers need most. The fix is resolving the import graph recursively before
chunking. It's the least glamorous function in the repo and the one that makes
the index worth anything.

**No stemming, so the best chunk was invisible.** Docs headings are written in
the gerund and the plural: "Capturing custom events". Developer questions come
in the infinitive and the singular: "how do I capture a custom event". To BM25
those share one word. The single most important chunk in my index — the React
`usePostHog` example, the demo query for the entire project — fell outside the
top *24* candidates. Nothing looked broken. It quietly returned the second-best
answer, every time.

**The heading boost was sabotaging itself.** I boosted heading matches the
obvious way: repeat heading tokens into the body, index once. But repetition
inflates document length, BM25 normalises by length, and short chunks got
rewarded twice. A 219-token aside called "Reset on logout" outranked the
canonical custom-event section for a question about capturing events. Two
fields, scored separately, fixed it.

**We were shipping code that couldn't run.** MDX `import` statements and the
JavaScript `import` statements inside the examples are the same syntax. My
stripper ran over the whole document body, and deleted
`import { usePostHog } from '@posthog/react'` from inside the code fence. The
most important passage in the index was handing agents React code missing its
import. I caught this by reading actual tool output at the very end, not from
any test.

Three of the four were found by the eval or by staring at real output. Zero were
found by the code looking wrong.

## The eval that lies to you

One guard is worth stealing. My case loader asserts that the number of parsed
cases equals the number the file declares, and that every gold label points at a
doc that actually exists in the index.

This sounds paranoid. It isn't. A loader that silently skips a malformed case
doesn't give you a slightly worse number — it gives you a confident number for a
different, smaller experiment, and nothing downstream can tell. You will report
it. An eval you can't trust is worse than no eval, because no eval at least
leaves you appropriately uncertain.

## What I'd fix, honestly

**28 cases is small, and I tuned against them.** Constants like the 0.42 score
floor were chosen by watching this eval. Some of that is fitting to my own test
set. The mitigation was to only make changes I could justify from principle —
"usefulness is concave in length" rather than "0.38 scored better" — but I'd
want a held-out set before claiming these numbers generalise.

**The token counter is `chars / 4`.** Not a real tokenizer. Every call goes
through one function so it's a one-line swap, but every number in this post
inherits that approximation.

**Two restraint failures remain.** Ask for "how do I remove a stored super
property" and it returns the right passage plus a passage about removing *person*
properties. Lexically almost identical, semantically a different API. BM25
cannot see the difference and my re-scoring doesn't either. This is the honest
case for adding embeddings — not for retrieval in general, but for exactly this:
telling near-synonyms apart.

**BM25 was deliberate, and I'd defend it.** Developer questions about an SDK are
unusually literal — `capture`, `identify`, `posthog.init`, `person_profiles`.
Rare, high-IDF terms: BM25's best case and embeddings' blurriest, since
`capture` and `identify` are neighbours in embedding space and opposites in an
API. It also keeps the experiment clean. Holding retrieval fixed means the delta
is attributable to assembly, which is the claim I wanted to make.

## The actual lesson

The retrieval took an afternoon. The eval took longer and taught me everything.

I didn't set out to build a system that returns less. I set out to build one
that returns the right thing, discovered I had no way to tell whether it did,
and found that the metric I was missing — *did it stop when it was done* — was
the one my system was failing hardest.

Context engineering isn't a retrieval problem with extra steps. Retrieval asks
"what matches?" An agent needs "what is the smallest set of passages that lets
me write correct code right now?" Those come apart fast, and they come apart
in a direction no standard metric points at.

Build the thing that measures restraint. It will tell you something the hit rate
never will.

---

*Code: [github.com/josephruocco/posthog-mcp-mini](https://github.com/josephruocco/posthog-mcp-mini).
BM25 over 185 heading-scoped chunks from PostHog's JS/Web SDK docs, served over
MCP. `python -m eval.run` reproduces every number here.*
