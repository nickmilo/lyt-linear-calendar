# LYT Linear Calendar

A linear calendar for Obsidian, by [Linking Your Thinking](https://www.linkingyourthinking.com). See your whole year at a glance, built on plain Markdown notes.

**Status:** in development (0.1.2). The year view draws every note that has a `start` date (or a `month`, for Sometime plans) and opens a note when you click it. Adding, moving and editing come next, along with Life Trends.

## Network use

The calendar's three fonts (Recursive, Atkinson Hyperlegible Next, Familjen Grotesk) load from Google Fonts. Without a connection it uses your system font. Nothing else leaves your vault.

## The notes

The plugin reads the same notes the free web app at lytlinearcalendar.com exports:

```
Linear/
  2027 Linear.md                ← the year: Intentions, Reflection
  2027-03-14 London trip.md     ← start, end (a span)
  2027-06-02 Launch day.md      ← start (a single date)
  Sometime/2027-04 Title.md     ← month (no day yet)
```

Properties: `start`, `end` (spans only), `month` (Sometime only), `category`, `hide-name`. Notes can live anywhere in the vault.

## Building

No npm or bundler. The shared core (`src/core`, also used by the web app) and the plugin shell (`src/plugin`) are joined into one file:

```
python3 tools/build.py     # writes main.js and styles.css
python3 test/smoke.py      # checks the build in headless Chrome against a stand-in for Obsidian's API
```

`styles.css` scopes the core's styles to the view and leaves out rules Obsidian's plugin review flags.

## License

[GPL-3.0](LICENSE). "Linking Your Thinking" and "LYT" are trademarks of Linking Your Thinking and are not covered by this license.
