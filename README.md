# Gradient Generator

A simple, good-looking CSS gradient generator. Pick colors, drag to blend them, copy the CSS.

**Try it:** https://gradient-app-eosin.vercel.app

<!-- Add a screenshot here, for example: ![Gradient Generator](screenshot.png) -->

## Why

CSS gradient generators already exist. Most of them are cluttered. This one is an attempt at a prettier, quieter version: the gradient fills the screen, the CSS sits right under the title, and the controls stay out of the way.

It's also built for designers as much as coders. Alongside the CSS, you can download any gradient as a PNG, so it works just as well for a slide, a mockup or a wallpaper as it does for a stylesheet. That's the differentiator: you don't need to write code to use what you make here.

## What it does

- **Color blocks you can resize.** Drag the seam between two colors to change how they blend. The percentages update as you drag.
- **Color picker where you click.** Click a color to change it with a picker that opens next to your cursor, or type a hex code.
- **Linear, radial and conic.** Set the angle with a dial, or drag a dot to place the center.
- **Copy CSS.** One click copies the `background` declaration.
- **Download PNG.** Save the gradient as an image in desktop, square or phone size, ready for design tools, slides or backgrounds. No code needed.
- **Older browsers.** A switch adds a fallback color and a `-webkit-` line for people who need them.
- **Presets.** Six starting points, from soft neutrals to brighter blends.
- **Works on phones.** The layout stacks, the colors become full-width strips, and everything fits on one screen.
- **Remembers your gradient.** Your last gradient is saved in the browser.

## How it was made

I designed this and directed the build; the code was written with [Claude Code](https://claude.com/claude-code).

It started as a rough Figma frame and went through a lot of sketches before and during the build. Most of the design work was deciding what to take away:

- A separate slider with dots became draggable seams on the color blocks themselves.
- Resize handles and remove buttons only appear on hover on desktop.
- A boxed "card" layout was tried and dropped in favor of a full-screen gradient with one floating control panel.
- Phones are capped at five colors so the controls and presets never fall off the screen.

## Built with

Plain HTML, CSS and JavaScript. No framework, no build step and no dependencies beyond two Google Fonts (Fraunces and DM Mono).

## Run it locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 5183
```

Then open http://localhost:5183.

## Ideas for later

Planned improvements are tracked in the [issues](https://github.com/gabibble/gradient-app/issues).
