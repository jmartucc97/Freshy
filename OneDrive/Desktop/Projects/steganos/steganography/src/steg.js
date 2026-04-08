/**
 * steg.js — LSB Steganography Engine
 *
 * Encodes and decodes secret text messages into/from PNG images
 * using the Least Significant Bit (LSB) technique.
 *
 * Strategy:
 *  - The last bit of each R, G, B channel is overwritten with a message bit.
 *  - Alpha channels are left untouched to preserve transparency.
 *  - A unique delimiter (ETX character, U+0003) marks the end of the message.
 *  - Message length (4 bytes) is stored in the first 32 pixel channels
 *    so decoding can terminate early and avoid false positives.
 *
 * Usage:
 *   const result = Steg.encode(imageData, "Hello, world!");
 *   const message = Steg.decode(imageData);
 */

const Steg = (() => {
  const DELIMITER = "\u0003"; // ETX — end of message marker
  const LENGTH_BITS = 32;     // First 32 bits store message byte-length

  /* ── Bit helpers ────────────────────────────────────── */

  /**
   * Convert a string to an array of bits (MSB first, UTF-8 encoded).
   * @param {string} text
   * @returns {number[]}
   */
  function textToBits(text) {
    const bytes = new TextEncoder().encode(text);
    const bits = [];
    for (const byte of bytes) {
      for (let b = 7; b >= 0; b--) {
        bits.push((byte >> b) & 1);
      }
    }
    return bits;
  }

  /**
   * Convert an array of bits back to a UTF-8 string.
   * @param {number[]} bits
   * @returns {string}
   */
  function bitsToText(bits) {
    const bytes = [];
    for (let i = 0; i + 7 < bits.length; i += 8) {
      let byte = 0;
      for (let b = 0; b < 8; b++) {
        byte = (byte << 1) | bits[i + b];
      }
      bytes.push(byte);
    }
    return new TextDecoder().decode(new Uint8Array(bytes));
  }

  /**
   * Convert a 32-bit unsigned integer to an array of 32 bits.
   * @param {number} n
   * @returns {number[]}
   */
  function uint32ToBits(n) {
    const bits = [];
    for (let i = 31; i >= 0; i--) {
      bits.push((n >> i) & 1);
    }
    return bits;
  }

  /**
   * Read a 32-bit unsigned integer from an array of bits.
   * @param {number[]} bits
   * @returns {number}
   */
  function bitsToUint32(bits) {
    let n = 0;
    for (let i = 0; i < 32; i++) {
      n = (n << 1) | (bits[i] & 1);
    }
    return n >>> 0; // force unsigned
  }

  /* ── Channel iterator ───────────────────────────────── */

  /**
   * Iterate over writable pixel channels (R, G, B — not Alpha).
   * Calls cb(pixelDataIndex) for each channel.
   * @param {Uint8ClampedArray} data - Raw ImageData.data
   * @param {function} cb - Receives index, returns false to stop early
   */
  function forEachChannel(data, cb) {
    for (let i = 0; i < data.length; i++) {
      if ((i % 4) === 3) continue; // skip alpha
      if (cb(i) === false) return;
    }
  }

  /* ── Public API ─────────────────────────────────────── */

  /**
   * Encode a message into an ImageData object (in-place copy).
   *
   * @param {ImageData} imageData - Source image data (not mutated)
   * @param {string}    message   - Plaintext message to hide
   * @returns {{ data: Uint8ClampedArray, width: number, height: number }}
   * @throws {Error} if the message is too long for the image
   */
  function encode(imageData, message) {
    const fullMessage = message + DELIMITER;
    const msgBits = textToBits(fullMessage);
    const msgByteLen = new TextEncoder().encode(fullMessage).length;
    const lengthBits = uint32ToBits(msgByteLen);
    const payload = [...lengthBits, ...msgBits];

    const maxChannels = Math.floor(imageData.data.length / 4) * 3;
    if (payload.length > maxChannels) {
      throw new Error(
        `Message too long. Image can hold ~${Math.floor(maxChannels / 8)} bytes ` +
        `but message needs ${Math.ceil(payload.length / 8)} bytes.`
      );
    }

    const newData = new Uint8ClampedArray(imageData.data);
    let bitIdx = 0;

    forEachChannel(newData, (i) => {
      if (bitIdx >= payload.length) return false;
      newData[i] = (newData[i] & 0xFE) | payload[bitIdx++];
    });

    return {
      data: newData,
      width: imageData.width,
      height: imageData.height,
    };
  }

  /**
   * Decode a hidden message from an ImageData object.
   *
   * @param {ImageData} imageData - Image suspected to contain a message
   * @returns {string|null} The hidden message, or null if none found
   */
  function decode(imageData) {
    const { data } = imageData;
    const rawBits = [];

    forEachChannel(data, (i) => {
      rawBits.push(data[i] & 1);
    });

    // Read the stored byte-length prefix
    if (rawBits.length < LENGTH_BITS) return null;
    const msgByteLen = bitsToUint32(rawBits.slice(0, LENGTH_BITS));

    // Sanity check: length can't exceed what the image holds
    const maxBytes = Math.floor(rawBits.length / 8);
    if (msgByteLen === 0 || msgByteLen > maxBytes) return null;

    const msgBits = rawBits.slice(LENGTH_BITS, LENGTH_BITS + msgByteLen * 8);
    if (msgBits.length < msgByteLen * 8) return null;

    const text = bitsToText(msgBits);
    const delimIdx = text.indexOf(DELIMITER);
    if (delimIdx === -1) return null;

    return text.slice(0, delimIdx);
  }

  /**
   * Calculate how many UTF-8 characters an image can hold.
   * (Approximate — assumes 1 byte per character for ASCII)
   *
   * @param {ImageData} imageData
   * @returns {number} max characters
   */
  function capacity(imageData) {
    const channels = Math.floor(imageData.data.length / 4) * 3;
    const availableBits = channels - LENGTH_BITS;
    // Reserve bytes for the delimiter (3 bytes for U+0003 in UTF-8)
    return Math.floor(availableBits / 8) - 3;
  }

  return { encode, decode, capacity };
})();

// Export for Node.js / module environments
if (typeof module !== "undefined" && module.exports) {
  module.exports = Steg;
}
