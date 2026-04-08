# ◈ Steganos

A clean, browser-based **LSB steganography** tool — hide secret text messages inside PNG images, and reveal them again. No server, no backend, no dependencies.

![screenshot](assets/screenshot.png)

## What is steganography?

Steganography is the practice of hiding information within ordinary, unsuspecting data. Unlike encryption — which scrambles data so it *looks* secret — steganography hides data so its *existence* is secret. The carrier image looks completely normal to the naked eye.

## How it works

This tool uses the **Least Significant Bit (LSB)** technique:

- Every pixel has 3 colour channels: **R**ed, **G**reen, **B**lue (0–255 each).
- The last bit of each channel is the "least significant" — changing it shifts the colour by 1/255, which is completely invisible.
- We overwrite those bits with bits from your message.
- A 1000×1000 px image has 3,000,000 writable bits → ~375,000 characters of capacity.

The first 32 bits store the message length, followed by the UTF-8 encoded message terminated with an ETX delimiter (`U+0003`).

```
[ 32-bit length prefix | message bits | ETX delimiter ]
     ↑ channels 0–31       ↑ channels 32+
```

⚠️ **Always share as PNG.** JPEG compression is lossy — it destroys the hidden bits. The output file is always saved as `steganos_output.png`.

## Usage

### Online
Just open `index.html` in any modern browser. No build step, no npm install.

### Local
```bash
git clone https://github.com/yourusername/steganos.git
cd steganos
open index.html        # macOS
start index.html       # Windows
xdg-open index.html    # Linux
```

Or serve it with any static server:
```bash
npx serve .
python3 -m http.server 8080
```

## Using the engine independently

`src/steg.js` is a self-contained module with no dependencies. You can use it in Node.js (with a canvas library like `node-canvas`) or import it into your own project.

```js
// Browser
const result = Steg.encode(imageData, "Hello, world!");
const message = Steg.decode(imageData);
const maxChars = Steg.capacity(imageData);
```

### API

#### `Steg.encode(imageData, message)` → `{ data, width, height }`
Hides `message` in a copy of `imageData`. Returns the modified pixel data.
- `imageData` — a browser `ImageData` object
- `message` — any UTF-8 string
- Throws `Error` if the message is too long for the image

#### `Steg.decode(imageData)` → `string | null`
Extracts the hidden message from `imageData`. Returns `null` if no message is found.

#### `Steg.capacity(imageData)` → `number`
Returns the approximate maximum number of characters the image can hold.

## File structure

```
steganos/
├── index.html        # App entry point
├── src/
│   ├── steg.js       # LSB engine (no dependencies)
│   ├── ui.js         # DOM / event handling
│   └── style.css     # All styles
└── README.md
```

## Browser support

Works in any browser with `Canvas 2D`, `FileReader`, `TextEncoder`, and `Blob` API support — Chrome, Firefox, Safari, Edge (all modern versions).

## Security considerations

- LSB steganography is **not encryption**. The message is hidden but not protected — anyone with this tool and the image can reveal it.
- For sensitive data, **encrypt your message first** before hiding it, e.g. with the Web Crypto API.
- Statistical analysis tools (steganalysis) can often detect the presence of LSB-encoded messages.

## Limitations

- Input images must be in a **lossless format** (PNG, BMP, TIFF). JPEG input is accepted but JPEG-compressed sources may already have noise in the LSBs.
- Output is always **PNG** to preserve the hidden bits.
- Large images (>20MP) may cause a brief pause during decode as all pixel channels are read.

## License

MIT — do whatever you want with it.
