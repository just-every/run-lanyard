# Lanyard Print

The PDF writer embeds only the used glyphs as Type3 vector outlines, with a
ToUnicode map for searching and copying the original text. The regular and bold
subsets come from GNU Unifont 16.0.04, under the SIL Open Font License 1.1 in
LICENSE.txt. Font glyphs keep that licence; the surrounding application is MIT.

Source: https://unifoundry.com/pub/unifont/unifont-16.0.04/font-builds/unifont_all-16.0.04.hex.gz

To regenerate glyphs.json, download that source during development and run:

```
node scripts/pack-print-font.mjs path-to-unifont_all.hex.gz
```

The generated asset contains gzip-compressed fixed records in code point order.
Each record has a big-endian code point (the high bit marks an eight-pixel-wide
glyph), then sixteen big-endian rows with left-aligned bits. No font service,
operating-system font or network request is used at runtime. Missing glyphs
raise an explicit error instead of silently substituting a different character.
The subsets and PDF object order depend only on the recorded text and layout.
