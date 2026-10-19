import { EventEmitter } from 'events';

// uiohook exposes mousemove rather than iohook's mousedrag. Preserve the
// application's string event types and global screen coordinates.
export function createInputHook(source: EventEmitter & { start(): void; stop(): void }) {
  const hook = new EventEmitter() as EventEmitter & { start(): void; stop(): void };
  let leftDown = false;
  source.on('mousedown', (event) => {
    if (event.button !== 1) return;
    leftDown = true;
    hook.emit('mousedown', { ...event, type: 'mousedown' });
  });
  source.on('mousemove', (event) => {
    if (leftDown) hook.emit('mousedrag', { ...event, type: 'mousedrag' });
  });
  source.on('mouseup', (event) => {
    if (event.button !== 1) return;
    leftDown = false;
    hook.emit('mouseup', { ...event, type: 'mouseup' });
  });
  hook.start = () => source.start();
  hook.stop = () => { leftDown = false; source.stop(); };
  return hook;
}
