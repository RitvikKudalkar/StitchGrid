# Palette sources

Each palette is a list of colour codes, names and approximate hex values. Hex values are screen approximations of real materials.

## dmc.json

DMC stranded cotton: code, name and RGB, from the table in [adrianj/CrossStitchCreator](https://github.com/adrianj/CrossStitchCreator) (`DMC Cotton Floss converted to RGB Values.csv`), with abbreviated names expanded. DMC is a trademark of DMC; StitchGrid is not affiliated with it.

## minecraft.json

Block names and the average colour of each block's texture, from the `color_cache.json` data in [blockpedia](https://crates.io/crates/blockpedia) 0.1.9. Curated to full, solid blocks with even faces; biome-tinted blocks (grass, leaves) and see-through blocks are left out. Tags: `wool`, `concrete`, `concrete-powder`, `terracotta`, `wood`, `stone`, `gravity` (falls when unsupported), `precious` (expensive in survival). No textures are shipped. Minecraft is a trademark of Mojang; StitchGrid is unofficial and not affiliated with Mojang or Microsoft.

blockpedia licence:

```
MIT License

Copyright (c) 2024 Harrison Nano112

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## pico8.json, gameboy.json, nes.json

Retro limited palettes as published on [Lospec](https://lospec.com/palette-list): `pico-8`, `nintendo-gameboy-bgb` and `nintendo-entertainment-system` (duplicates removed). Shown under neutral names; PICO-8 is by Lexaloffle, and Nintendo, Game Boy and NES are trademarks of Nintendo. StitchGrid is not affiliated with either.
