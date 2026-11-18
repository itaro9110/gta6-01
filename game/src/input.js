// input.js — keyboard and mouse for SOLMARA.
// One file, one job: it turns DOM events into a small, frame-friendly
// state the world reads each tick. Keys are held in a set; presses that
// should fire once (E to steal, P to pause, M to mute, Space to shoot)
// are recorded as edge-triggered "just pressed" flags that main.js
// clears at the end of every frame. The mouse position is tracked in
// canvas pixels so the player can aim with it.

export function createInput(canvas) {
  const keys = new Set();
  const justPressed = new Set();
  const mouse = { x: canvas.width / 2, y: canvas.height / 2, down: false, justDown: false };

  function keyName(e) {
    const k = e.key.toLowerCase();
    if (k === ' ') return 'space';
    return k;
  }

  function onKeyDown(e) {
    const k = keyName(e);
    if (['space', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    if (!keys.has(k)) justPressed.add(k);
    keys.add(k);
  }

  function onKeyUp(e) {
    keys.delete(keyName(e));
  }

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    onMouseMove(e);
    mouse.down = true;
    mouse.justDown = true;
  }

  function onMouseUp(e) {
    if (e.button !== 0) return;
    mouse.down = false;
  }

  function onBlur() {
    keys.clear();
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    keys,
    mouse,
    // Held down this frame?
    down(name) {
      return keys.has(name);
    },
    // Pressed exactly once since the last clear?
    pressed(name) {
      return justPressed.has(name);
    },
    // Any of these held?
    any(names) {
      return names.some((n) => keys.has(n));
    },
    // Movement vector from WASD / arrows, normalised.
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    // Called by main.js at the end of every frame.
    endFrame() {
      justPressed.clear();
      mouse.justDown = false;
    },
  };
}
