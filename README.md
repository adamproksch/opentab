# opentab

A customizable Chromium browser for Windows with built-in ad and tracker blocking, built on Electron.

Website and downloads: [opentab.cc](https://www.opentab.cc)

## Features

- Ad and tracker blocking with Standard and Strict filter levels, per-site toggles, and a list of what was blocked on each page
- Themes, an editable toolbar layout, and a sidebar with panels and notes
- A downloads manager that holds files that can run programs until you choose Keep
- Permission prompts in a bar under the toolbar, and a site info panel for each site
- Private tabs, bookmarks (including import from Chrome, Edge, Brave and Opera), history, and session restore
- Tab sleeping and per-tab memory use
- Unpacked Chrome extensions (content scripts only)
- A built-in music player

## Run from source

Requires Node.js 20 or newer, on Windows.

```sh
npm install
npm start
```

## Tests

```sh
npm test
```

## Build the installer

```sh
npm run dist
```

The installer and portable build are written to `dist/`.

## License

Free for personal and non-commercial use. See [LICENSE.txt](LICENSE.txt) for the full terms. This is not an open-source license.
