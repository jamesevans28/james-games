# Store listings (T10.6): draft text for App Store Connect and Play Console

Claude drafted this. **James** checks the wording, the age band and the prices, then pastes it in. The same text is used on both stores unless noted.

## Basics

| Field                                | Value                                                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| App name                             | Games4James                                                                                                                       |
| Subtitle (Apple, 30 chars)           | Little games made by a family                                                                                                     |
| Short description (Google, 80 chars) | Small, silly games made by James, Tilly and Harvey. Free, no ads.                                                                 |
| Bundle ID / package                  | `com.games4james.app`                                                                                                             |
| Category                             | Games › Family (Apple: also apply for the **Kids** category, age band **6–8**). Google: Games › Casual, Teacher Approved: not yet |
| Price                                | Free. One optional in-app purchase later (T12.3)                                                                                  |
| Support URL                          | https://games4james.com/parents                                                                                                   |
| Marketing URL                        | https://games4james.com                                                                                                           |
| Privacy policy URL                   | https://games4james.com/privacy                                                                                                   |
| Copyright                            | © 2026 James Evans                                                                                                                |

## Description

> Games4James is a little box of games made at our kitchen table by James, Tilly and Harvey.
>
> Snap the crocs before they get your raft. Copy the flashing lights. Float a basketball through the hoops over the city. Build a tower of words. Every game is short, silly and made to be played again.
>
> • Free to play, with no ads, ever
> • Play straight away as a guest, no sign-up needed
> • Make a username and a 6-digit PIN to keep your scores
> • Friends only: add a friend with their secret friend code, never by searching names
> • Collect a sticker every week you play on three different days
> • New games when we make them (we're working on the next one now)
>
> For grown-ups: there are no ads and no tracking across apps or websites. Friends are added by code only, and "show when I'm online" is off unless you turn it on. Anything that leaves the app, like an email or a web page, is behind a grown-ups-only question. See games4james.com/parents.

## Keywords (Apple, 100 chars)

`kids games,family,arcade,puzzle,crocodile,word game,no ads,offline,tilly,harvey`

## What's new (first release)

> Hello! This is our first version. We hope you like playing them as much as we liked making them.

## Screenshots

Needed: 6.7" and 6.1" iPhone, an Android phone, and optionally a 12.9" iPad. Take them from the simulator and emulator after the Phase 8 art. The planned `scripts/art/store-shots.mjs` puts each in a frame with a short caption in the brand font. Suggested set:

1. the home grid,
2. Snapadile mid-game,
3. game over with "New best!",
4. the friends page with a friend code,
5. the sticker on the profile.

## Privacy "nutrition label" answers

| Data                                                   | Collected? | Linked to the user? | Used for tracking? | Purpose                               |
| ------------------------------------------------------ | ---------- | ------------------- | ------------------ | ------------------------------------- |
| User ID (Firebase uid)                                 | Yes        | Yes                 | No                 | App functionality                     |
| Name (screen name, made up; username for sign-in)      | Yes        | Yes                 | No                 | App functionality                     |
| Email (only if a grown-up adds one for sign-in)        | Optional   | Yes                 | No                 | App functionality, account management |
| Gameplay content (scores, plays, stickers)             | Yes        | Yes                 | No                 | App functionality                     |
| Contacts, location, photos, health, browsing, ads data | No         |                     |                    |                                       |
| Diagnostics                                            | No         |                     |                    |                                       |

Tracking: **No.** No third-party analytics or ads SDKs run in the apps; the web's Cloudflare beacon is turned off natively.

## Content rating answers (IARC / Apple age rating)

- Violence: cartoon or fantasy, infrequent and mild. The crocs "snap" and the aliens pop; there's no blood.
- Fear, sexual content, language, drugs, gambling, horror: **none**.
- User-generated content: screen names only, filtered and moderated (T6.7). There's no free-text chat and no images.
- Users can interact: **friends only, by code**. There's no open chat and no location sharing.
- In-app purchases: none at first; later one optional grown-up purchase behind a parental gate (T12.3).
- Expected result: Apple 4+, IARC 3+ / Everyone.
