---
layout: post
title: "Measuring Silence"
subtitle: "An eval that only counts what you found will teach your system to never shut up"
date: 2026-07-27
type: essay
---

The first working version of Summa put forty highlights on a page of *Moby-Dick*.

Summa is a macOS overlay that annotates whatever you're reading. It captures the
frontmost window, OCRs it, asks a model what a well-read reader would miss in that
passage, and draws the answer as a layer on top of Kindle or a PDF or a browser
tab. Forty highlights meant it was working, in the sense that every component ran
and every annotation was defensible. `Ahab` got a note. So did `whale`, `sea`,
`captain`, and `the Pequod` for the fourth time on the same page.

It was also unusable. A page with forty highlights is a page you stop reading.

That failure took a while to name, because it doesn't look like a failure. Nothing
crashed. Nothing was factually wrong. The model had been asked to find things a
reader might miss, and it found things a reader might miss. The problem was that
finding is only half the job, and it was the only half anyone had specified,
including me, including my eval.

## The thing nobody measures

Ask what makes a retrieval system good and you'll get precision and recall.
Precision: of what you returned, how much was right. Recall: of what was out
there, how much did you find. Both are about the returned set. Neither has a
vocabulary for the decision *not to return anything*, which for an annotation
system is most of the decisions it makes.

You can technically catch this in precision. An unwanted annotation is a false
positive, so precision falls. But it only falls if the unwanted thing is in your
test set with a label saying it's unwanted, and almost nobody builds test sets
that way. Test sets get built by reading a passage and writing down what should
have been found, because that's the natural motion. You end up with a hundred
cases that all say *yes, this one, this target*, and a scoring function that is
mathematically capable of penalizing over-annotation but has been handed no
examples of it.

So the eval says 94% and the product puts forty highlights on the page.

The fix is boring and it is most of the work: put the silence in the ground truth.
Summa's set now has a hundred hand-curated cases across fourteen works, and each
one carries a verdict:

```json
{ "bookId": 2701, "phrase": "Alleghanies", "expected": "Allegheny Mountains", "verdict": "ok" }
{ "bookId": 2701, "phrase": "the whale",   "verdict": "suppress" }
```

Sixty-eight say *annotate this, and resolve it to this specific target*. Twelve
say *this deserves a short note, but forcing an encyclopedia article on it would
be misleading*. The `White Dog` of the Iroquois midwinter sacrifice is a real
reference with no safe Wikipedia title. And twenty say **leave this alone**.

The twenty are the ones that changed the system. They're what turns "the model
annotated something" from a neutral event into a scoreable one. Before they
existed, every prompt change that increased coverage looked like an improvement.

They also changed the prompt, which now spends most of its length on prohibition
rather than instruction:

> Annotate only what a smart, well-read non-specialist would genuinely miss. Never
> define common words. Never restate the text. Never summarize plot. Be selective:
> at most roughly one annotation per two sentences. **Zero annotations is a
> correct, valid answer for plain text. Do not pad.**

That last line took an embarrassing number of attempts. Getting a model to return
an empty array is meaningfully harder than getting it to return twenty items. It
has been trained, relentlessly, to be useful, and an empty response does not feel
useful. You have to tell it explicitly that nothing is an acceptable answer, and
then you have to score it on whether it believed you.

## The harness was lying, and I built the harness

Here is the part I'd rather not write.

The loader for that ground truth set skipped any entry containing a `_comment`
key, because `_comment` was how I annotated the files for humans:

```python
for entry in data:
    if "_comment" in entry:
        continue
```

Reasonable, except `_comment` doubles as a section header, and section headers go
on the *first entry* of each file, an entry which is also a real test case. Every
book file therefore donated its first case to the void. Fourteen of a hundred,
including `Moby Dick` itself, `Wuthering Heights`, `Kant`, `Socrates`, and
`Sir Francis Drake`.

It never errored. It printed:

```
Loaded 86 ground truth entries from tools/ground_truth (14 files)
```

and I read that line for months without doing the subtraction. Every precision
figure I'd used to justify a prompt change had been computed against the wrong
denominator, and the missing cases were systematically the *first* case in each
file, which, because of how I'd written them, skewed toward the most obvious,
most important references in each work.

What surprised me is that the harness got away with it *because* it was
well-built. It printed a full confusion matrix. It named every individual failure
so regressions were diagnosable. It looked like a serious instrument, and serious
instruments don't get audited. A crash I'd have found in an afternoon. A silent
fourteen percent haircut on the denominator survived until I went looking for
something else entirely.

Test harnesses need tests. I don't know a way to say that which doesn't sound
trite, and I still think it's the most expensive thing I learned.

## Stop improving the input, start removing the authority

The other recurring problem had the same shape as the first, and the same
solution.

Summa's model has to quote an exact substring from the screen, because that's how
the highlight gets positioned. No anchor, no rectangle, no annotation. And it
would routinely return something *nearly* right. Smart quotes normalized. A
possessive dropped. Occasionally a phrase that was a plausible paraphrase of the
passage and simply not in it.

I spent real time trying to prompt my way out of this. Stronger instructions,
`temperature: 0`, examples of correct anchoring. All of it helped and none of it
closed the gap, because I was asking a generative system to be reliably
extractive.

What worked was giving up on the model's honesty as a mechanism. Every anchor now
gets normalized, lowercased, smart quotes folded, punctuation stripped, since
punctuation is where OCR and the model most often disagree, and then matched
against a contiguous run of real OCR tokens. If the run isn't there, the
annotation is discarded silently. The highlight rectangle is built by unioning the
bounding boxes of the *actual tokens*, never from anything the model returned.

The model proposes. Something it cannot fabricate disposes.

Both of my expensive problems, restraint and hallucinated anchors, resolved the
same way: not by improving what went into the model, but by narrowing what it was
permitted to decide. I went in assuming I'd spend my time on prompts. I spent it
on the machinery around them.

## Why this generalizes past highlighting books

I've been describing a reading tool, but the shape isn't specific to reading.

Every retrieval-augmented system, every documentation pipeline, every agent with a
context window is making the same two decisions Summa makes: what to surface, and,
far more often, what to leave out. And the second decision is almost universally
unmeasured. We benchmark whether the right chunk was retrieved. We rarely benchmark
whether nine irrelevant chunks came with it, because the eval set doesn't contain
an entry that says *nothing here is relevant, return nothing*.

Anyone who has watched an agent drown in its own context has watched a system with
excellent recall and no vocabulary for restraint. The failure mode is identical to
forty highlights on a page: every individual retrieval defensible, the aggregate
useless. Context windows got bigger and the temptation got worse, because now you
*can* stuff everything in, so the cost of not deciding is deferred rather than paid.

I don't think bigger windows fix this and I don't think better models fix this. A
model can only be as selective as your eval lets you verify it's being. If your
ground truth has no examples of *correctly returning nothing*, you have no
instrument for the failure that's actually going to sink you. And worse, every
change that makes your system louder will score as progress.

Put the silence in the test set. Then go check that your loader is reading all of
it.

---

*Summa is [open source](https://github.com/josephruocco/Summa). The ground truth
set, the annotation-type gold sets, and the eval scripts are in `tools/`.*
