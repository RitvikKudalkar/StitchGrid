## Project

StitchGrid: free, private, in-browser tools that turn a photo into a printable craft pattern. The plan is `execution-plan.md`; the design system is `DESIGN.md`. Read both before working on a phase.

- One branch and pull request per phase; never push straight to `main` (pushing to `main` deploys).
- Site constants (domain, contact, GA ID) live only in `src/data/site.ts`. Tools, their thread colours and `live` flags live in `src/data/tools.ts`.
- Nothing the visitor makes may leave the browser. No network calls during processing, no remote fonts.
- Example images in `src/assets/examples/` are AI-generated placeholders until launch.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

`npm run check:contrast` checks every colour pair in the tokens.

## Documentation

Full documentation: https://docs.astro.build
