/**
 * ui.js — Steganos UI Controller
 *
 * Handles all DOM interactions, file loading, drag-and-drop,
 * and delegates encoding/decoding to steg.js.
 */

(() => {
  /* ── State ────────────────────────────────────── */
  const state = {
    encImageData: null,
    decImageData: null,
  };

  /* ── Element refs ─────────────────────────────── */
  const $ = (id) => document.getElementById(id);

  const enc = {
    drop:       $("enc-drop"),
    file:       $("enc-file"),
    browse:     $("enc-browse"),
    img:        $("enc-img"),
    loaded:     $("enc-loaded"),
    filename:   $("enc-filename"),
    dimensions: $("enc-dimensions"),
    capFill:    $("enc-cap-fill"),
    capText:    $("enc-cap-text"),
    msg:        $("enc-msg"),
    charCount:  $("enc-char-count"),
    capWarn:    $("enc-capacity-warn"),
    btn:        $("enc-btn"),
    status:     $("enc-status"),
    canvas:     $("enc-canvas"),
  };

  const dec = {
    drop:       $("dec-drop"),
    file:       $("dec-file"),
    browse:     $("dec-browse"),
    img:        $("dec-img"),
    loaded:     $("dec-loaded"),
    filename:   $("dec-filename"),
    dimensions: $("dec-dimensions"),
    btn:        $("dec-btn"),
    status:     $("dec-status"),
    result:     $("dec-result"),
    text:       $("dec-text"),
    copy:       $("dec-copy"),
    canvas:     $("dec-canvas"),
  };

  /* ── Tab switching ────────────────────────────── */
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      document.querySelectorAll(".tab").forEach((t) => {
        t.classList.toggle("active", t.dataset.tab === target);
        t.setAttribute("aria-selected", t.dataset.tab === target);
      });
      document.querySelectorAll(".panel").forEach((p) => {
        const isActive = p.id === target;
        p.classList.toggle("active", isActive);
        p.hidden = !isActive;
      });
    });
  });

  /* ── Status helpers ───────────────────────────── */
  function showStatus(el, message, type) {
    el.textContent = message;
    el.className = `status-msg ${type}`;
    el.hidden = false;
  }

  function hideStatus(el) {
    el.hidden = true;
  }

  /* ── Image loading ────────────────────────────── */

  /**
   * Load an image file into an HTMLCanvasElement and return ImageData.
   * @param {File} file
   * @param {HTMLCanvasElement} canvas
   * @returns {Promise<ImageData>}
   */
  function fileToImageData(file, canvas) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        reject(new Error("File must be an image."));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
        };
        img.onerror = () => reject(new Error("Could not load image."));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Show a preview of the loaded image and update metadata fields.
   */
  function showEncPreview(file, imageData) {
    enc.img.src = URL.createObjectURL(file);
    enc.filename.textContent = file.name;
    enc.dimensions.textContent = `${imageData.width} × ${imageData.height} px`;
    enc.loaded.hidden = false;
    enc.drop.querySelector(".drop-inner").hidden = true;
    updateCapacity(imageData);
    updateCharCount();
  }

  function showDecPreview(file, imageData) {
    dec.img.src = URL.createObjectURL(file);
    dec.filename.textContent = file.name;
    dec.dimensions.textContent = `${imageData.width} × ${imageData.height} px`;
    dec.loaded.hidden = false;
    dec.drop.querySelector(".drop-inner").hidden = true;
  }

  function updateCapacity(imageData) {
    if (!imageData) return;
    const cap = Steg.capacity(imageData);
    const msgLen = new TextEncoder().encode(enc.msg.value).length;
    const pct = Math.min(100, Math.round((msgLen / cap) * 100));
    enc.capFill.style.width = `${pct}%`;
    enc.capText.textContent = `${cap.toLocaleString()} chars`;
    enc.capFill.style.background = pct > 90 ? "var(--danger)" : "var(--accent)";
  }

  function updateCharCount() {
    const val = enc.msg.value;
    enc.charCount.textContent = `${val.length.toLocaleString()} chars`;
    if (state.encImageData) {
      const cap = Steg.capacity(state.encImageData);
      const over = new TextEncoder().encode(val).length > cap;
      enc.capWarn.hidden = !over;
      updateCapacity(state.encImageData);
    }
  }

  /* ── Drag and drop ────────────────────────────── */
  function setupDrop(dropEl, onFile) {
    dropEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropEl.classList.add("drag-over");
    });
    dropEl.addEventListener("dragleave", () => {
      dropEl.classList.remove("drag-over");
    });
    dropEl.addEventListener("drop", (e) => {
      e.preventDefault();
      dropEl.classList.remove("drag-over");
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    });
    dropEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") dropEl.click();
    });
  }

  /* ── Encode flow ──────────────────────────────── */

  async function handleEncFile(file) {
    try {
      hideStatus(enc.status);
      const imageData = await fileToImageData(file, enc.canvas);
      state.encImageData = imageData;
      showEncPreview(file, imageData);
    } catch (err) {
      showStatus(enc.status, err.message, "err");
    }
  }

  enc.browse.addEventListener("click", (e) => {
    e.stopPropagation();
    enc.file.click();
  });
  enc.file.addEventListener("change", () => {
    if (enc.file.files[0]) handleEncFile(enc.file.files[0]);
  });
  enc.drop.addEventListener("click", (e) => {
    if (e.target === enc.browse) return;
    enc.file.click();
  });
  setupDrop(enc.drop, handleEncFile);
  enc.msg.addEventListener("input", updateCharCount);

  enc.btn.addEventListener("click", async () => {
    hideStatus(enc.status);
    if (!state.encImageData) {
      showStatus(enc.status, "Please load a carrier image first.", "err");
      return;
    }
    const message = enc.msg.value.trim();
    if (!message) {
      showStatus(enc.status, "Please enter a message to hide.", "err");
      return;
    }

    enc.btn.disabled = true;
    enc.btn.querySelector("span").textContent = "Encoding…";

    try {
      const result = Steg.encode(state.encImageData, message);
      const ctx = enc.canvas.getContext("2d");
      ctx.putImageData(new ImageData(result.data, result.width, result.height), 0, 0);

      enc.canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "steganos_output.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        showStatus(enc.status, "✓ Image downloaded as steganos_output.png — share this PNG to deliver your message.", "ok");
      }, "image/png");
    } catch (err) {
      showStatus(enc.status, err.message, "err");
    } finally {
      enc.btn.disabled = false;
      enc.btn.querySelector("span").textContent = "Embed & Download";
    }
  });

  /* ── Decode flow ──────────────────────────────── */

  async function handleDecFile(file) {
    try {
      hideStatus(dec.status);
      dec.result.hidden = true;
      const imageData = await fileToImageData(file, dec.canvas);
      state.decImageData = imageData;
      showDecPreview(file, imageData);
    } catch (err) {
      showStatus(dec.status, err.message, "err");
    }
  }

  dec.browse.addEventListener("click", (e) => {
    e.stopPropagation();
    dec.file.click();
  });
  dec.file.addEventListener("change", () => {
    if (dec.file.files[0]) handleDecFile(dec.file.files[0]);
  });
  dec.drop.addEventListener("click", (e) => {
    if (e.target === dec.browse) return;
    dec.file.click();
  });
  setupDrop(dec.drop, handleDecFile);

  dec.btn.addEventListener("click", () => {
    hideStatus(dec.status);
    dec.result.hidden = true;

    if (!state.decImageData) {
      showStatus(dec.status, "Please load an image first.", "err");
      return;
    }

    dec.btn.disabled = true;
    dec.btn.querySelector("span").textContent = "Decoding…";

    // Yield to browser to update UI before heavy computation
    setTimeout(() => {
      try {
        const message = Steg.decode(state.decImageData);
        if (message === null) {
          showStatus(
            dec.status,
            "No hidden message found. Make sure the image was encoded with Steganos and saved as a lossless PNG — JPEG compression destroys hidden data.",
            "err"
          );
        } else {
          dec.text.textContent = message;
          dec.result.hidden = false;
          showStatus(dec.status, `✓ Message decoded — ${message.length.toLocaleString()} characters found.`, "ok");
        }
      } catch (err) {
        showStatus(dec.status, `Decode error: ${err.message}`, "err");
      } finally {
        dec.btn.disabled = false;
        dec.btn.querySelector("span").textContent = "Reveal Message";
      }
    }, 30);
  });

  dec.copy.addEventListener("click", async () => {
    const text = dec.text.textContent;
    try {
      await navigator.clipboard.writeText(text);
      dec.copy.textContent = "Copied!";
      setTimeout(() => (dec.copy.textContent = "Copy to clipboard"), 2000);
    } catch {
      dec.copy.textContent = "Copy failed";
      setTimeout(() => (dec.copy.textContent = "Copy to clipboard"), 2000);
    }
  });
})();
