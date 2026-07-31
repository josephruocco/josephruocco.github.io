---
layout: post
title: "Docs Have Two Readers Now"
subtitle: "A code sample that needs the page around it is a code sample a model will get wrong"
date: 2026-07-31
type: essay
---

I built a small search tool over PostHog's docs last weekend. You give it a question, it digs the most relevant passage out of a few hundred pages, and it hands that passage to a model. The first thing I asked was the question every new user has: how do you send a custom event from the browser? It found the right page and pulled out the right lines.

```js
posthog.capture('user_signed_up')
```

That's a correct answer. Paste it into an empty project and nothing happens, because there's no import at the top of the file and posthog was never set up. Anyone reading the real docs page would already know that. They'd have passed the install section on the way down to this example, so the setup is still in their head when they get here. The model never saw the page. It saw the passage I gave it, and as far as it can tell, that passage is the whole story.

That gap is what I want to get at. We spent a long time writing docs for one kind of reader, with a few quiet assumptions baked in. The reader has the whole page in front of them. They move around it freely. If what they need is a few sections up, they'll get there, because people read downward and hold onto what they've read. Under those assumptions a code sample never has to survive on its own. The page around it does the work.

Now there's a second reader on the page, and it works nothing like the first. A model doesn't read your page. It reads whatever passage a retriever picked out, and it takes that passage as the truth of the matter. Scrolling up to find the install step isn't something it can do. It has no idea the init call two pages away is the thing that makes the line in front of it run, and it can't reliably separate your real SDK reference from some post you wrote two years ago that happens to rank well.

So details that used to be cosmetic start deciding whether the answer works. Look at where the install step lives. On the PostHog events page the install snippet and the capture example sit in different spots, which is the right choice for a person, since copying the install onto every page would just be clutter. The retriever cuts the page on those same seams. The capture example ends up on its own, missing the line above it that makes it go.

The fix is small enough to show. Here's the events snippet close to how it ships:

```js
posthog.capture('user_signed_up')
```

And here's the same idea, written for a reader who gets this passage and nothing else around it:

```js
// posthog-js needs to be installed and set up once, when your app boots.
// If that hasn't happened yet:
import posthog from 'posthog-js'
posthog.init('<your_project_token>', { api_host: 'https://us.i.posthog.com' })

// From then on, anywhere in the app:
posthog.capture('user_signed_up')
posthog.capture('plan_purchased', { price: 1599, plan_id: 'XYZ12345' })
// Full reference: posthog.com/docs/libraries/js
```

The second one brings its own setup along. It shows a path you can actually run instead of a fragment, and it names a single page to trust instead of leaving the model to average five of them together.

What caught me off guard is that the second version is better for the person too. Someone skimming the events page no longer has to stop, go find the install doc, and come back to fill in the init call before anything runs. That one link to a canonical page spares them the guessing it spares the model. The version that stands on its own turns out to be the version they were going to copy anyway.

I don't think that's a coincidence. Writing a doc so a model can use it mostly means writing it for a reader who's tired or brand new to the tool. We wrote for a patient one who had all day and the full page in view. Most of the actual humans were never that reader. The model just can't fake being it.

If you write docs, you've got a second audience now, and it can't skim and won't give you the benefit of the doubt. That sounds like extra work, and some of it is. Mostly it takes old advice that was easy to nod at, keep things self-contained, keep one source of truth, and turns it into something you can test. Take one of your pages and cut it the way a retriever would, along the headings and the code fences. Read a single piece with nothing around it. If it can't hold up alone, a rushed person was already stumbling on it, and a model is about to hand the broken version to someone who trusts it. Write the line that lets that piece hold up on its own, and you've fixed it for both readers at once.
