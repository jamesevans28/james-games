# Prompt files

One file per asset category. `scripts/art/generate.mjs` reads them, so keep the format:

```
### <asset-name>
Subject: <what to draw; goes into {subject} in the base prompt>
Composition: <optional extra sentence appended to the prompt>
Output: <where the processed file ends up; for people, the scripts take paths as arguments>
```

`<asset-name>` is the file name the raw image should have in `art-inbox/<category>/` (for example `art-inbox/covers/snapadile.png`).
