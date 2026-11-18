// SOLMARA — keyboard and mouse.
// Held keys steer Leo; one-shot presses (confirm, pause, punch, enter) are
// queued as flags and taken once by the loop, so a press between two frames
// is never lost and never counted twice. The mouse aims the gun.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;
export const ACTION_CONTINUE = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const CONTINUE = new Set(['KeyC']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mutePressed = false;
  const mouse = { x: 0, y: 0, clicked: false, clickX: 0, clickY: 0 };

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (ENTER.has(event.code)) actions |= ACTION_ENTER;
    else if (PUNCH.has(event.code)) actions |= ACTION_PUNCH;
    else if (CONTINUE.has(event.code)) actions |= ACTION_CONTINUE;
    else if (MUTE.has(event.code)) mutePressed = true;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.clear();
    mouse.clicked = false;
  });
  // No context menu over the game: a right-click is just another shot.
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.clicked = true;
    mouse.clickX = mouse.x;
    mouse.clickY = mouse.y;
    actions |= ACTION_SHOOT | ACTION_CONFIRM;
  });

  function has(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    // Held steering, as -1/0/1 on each axis.
    axes() {
      return {
        up: has(UP),
        down: has(DOWN),
        left: has(LEFT),
        right: has(RIGHT),
      };
    },
    // Is E held down right now (for the vault crack)?
    enterHeld() {
      return held.has('KeyE');
    },
    mouse,
    // Take the queued one-shot presses since the last call.
    takeActions() {
      const taken = actions;
      actions = 0;
      const clicked = mouse.clicked;
      mouse.clicked = false;
      return { actions: taken, clicked };
    },
    // Take the mute toggle (M) since the last call.
    takeMute() {
      const was = mutePressed;
      mutePressed = false;
      return was;
    },
  };
}
