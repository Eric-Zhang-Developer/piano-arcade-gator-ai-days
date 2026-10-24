# Product philosophy

**Frozen by the user on 2026-10-24.** This is the canonical philosophy for
this project. Read it before every product, UI or code decision. Change the
core principles only when the user explicitly revises them; implementation
work must not silently redefine them.

## Core principles

1. **Resolve feeling lost.** Offer the familiar experience of a personal piano
   tutor who helps the learner know what to do next. The graph, agent and
   personalization technology serve that experience; they are not the promise.
2. **Stay with the learner.** Convey coziness, safety and a dependable “I got
   you” presence throughout the experience, including transitions, practice,
   feedback, mistakes and recovery. Accompaniment is continuous behavior,
   not just a character on the home page.
3. **Carry the unnecessary decisions.** Make the next useful step clear and
   shoulder planning rather than asking learners to manage the system's
   categories. Keep meaningful human control: guidance must leave room to
   stop, ask for help, recover and act deliberately. Fewer buttons should
   reduce lostness, not remove agency.
4. **Believe in capability and encourage stretch.** Safety makes the learning
   adventure possible. Push the learner's limits with useful tools and
   appropriate scaffolding. Do not coddle, abandon or shame them. Help them
   become able to do more for themselves; permanent dependence is not success.
5. **Make reassurance trustworthy.** Be confident about support and a path
   forward. Ground feedback and progress claims in available evidence, name
   uncertainty honestly, and make recovery understandable. Assurance must
   not become a guarantee of learning outcomes or invented mastery.
6. **Express one promise throughout.** UI, copy, brand, color, typography,
   motion and code behavior must work together to convey warmth, safety,
   capable guidance and growing independence. A cozy palette cannot make up
   for an interaction that leaves the learner stranded.

## Decision filter

Before choosing an interface, interaction or implementation, ask:

- Does this reduce lostness and make the next useful step understandable?
- Does the tutor's reassuring presence continue through transitions and failure?
- Does this remove an unnecessary decision while preserving meaningful control?
- Does this help a capable learner stretch and grow toward independence?
- Are feedback, recovery and capability claims honest about the evidence?

If an answer is no, revise the implementation. If the core philosophy itself
must change, obtain an explicit user revision rather than an implicit exception.

## What can evolve

Specific palettes, fonts, mascot artwork, graph rendering, motion mechanics,
models and learning workflows are implementation decisions. They may evolve
under this philosophy and the applicable feature specs. This document freezes
the purpose and relationship with the learner, not those design choices, a
particular teaching algorithm, or claims that a prototype already delivers
a connected personal tutor.

## Verbatim source

The user's philosophy-freeze statement, 2026-10-24, reproduced verbatim from
the task's captured user intent, including spoken repetitions:

> Okay, so for the general direction of the product I want you to put this and freeze this in like a in the directory so that you reference this every time that you want to establish the type of reasoning that you have to have to build a good interface or coding snippets. Literally, this is the philosophy that you're going to take on for for the rest of the project.
>
> This is the philosophy. What we're really selling is not personalized education at scale, we're not selling a graph that we have an agent on top of. What we're really selling Is the resolution to the problem of feeling lost when you play piano? And not only is the resolution, it's the resolution that people are familiarized with: a personal tutor for you, right? It's a personal tutor that'll guide you, that'll bring you coziness and safety, that'll be there with you the entire time throughout the experience so that you feel safe and you feel like you're never gonna be lost. You have someone that guides you, someone that guarantees that you're gonna be fine in the end. And the fineness would be learning, right? And so, like, we this also should be reflexive in the UI, in that we have this great technology that can genuinely do this now. Why do we have extra buttons? If we can provide an extra level of, oh, yeah, I got it for you. And have that be reflexive also in the brand identity, in the way that the colors are played out. This should feel coziness. This should feel safety. This should feel like an I got you. And I'll be there with you. I'll handhold you.
>
> So, another thing that you have to watch out for is that it's not coddling, right? It's. Also pushing your limits. It is helping you get through the adventure of what learning piano would be. giving you the tools so that you can eventually get and do this yourself. It believes in you.
