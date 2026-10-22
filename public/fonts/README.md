# Lanyard fonts

Three families, self-hosted, each under the SIL Open Font License 1.1 with its licence beside the files.
No page requests third-party fonts.

| Family | Use | Files | Licence | Upstream |
| --- | --- | --- | --- | --- |
| Source Serif 4 (italic, variable weight and optical size) | headings only: the homepage H1 and H2s, docs and /run titles, the app's page title | `source-serif-4/` (Latin) | `source-serif-4/LICENSE.txt` | https://github.com/adobe-fonts/source-serif |
| Inter (variable weight) | everything else, with tabular numerals; the Lanyard wordmark | `inter/` (Latin) | `inter/LICENSE.txt` | https://github.com/rsms/inter |
| IBM Plex Mono (400, 500, 600) | the punch strip on the homepage, commands and code | `ibm-plex-mono/` (Latin) | `ibm-plex-mono/LICENSE.txt` | https://github.com/IBM/plex |

The WOFF2 subsets come from Fontsource's distributions: `@fontsource-variable/source-serif-4` 5.3.1,
`@fontsource-variable/inter` 5.3.0 and `@fontsource/ibm-plex-mono` 5.3.0. `rer-theme.css` declares them once,
beside Base's theme tokens, so the installer serves them too; `fonts.css` names the stacks (`--font-serif`,
`--font-sans`, `--font-mono`) with Lanyard's other tokens.
