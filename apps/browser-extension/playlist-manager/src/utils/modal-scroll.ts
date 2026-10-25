let locks = 0;
let previousOverflow = "";

/** Nested dialogs may finish in either order; restore scrolling only after the last one. */
export function lockPageScroll(): () => void {
  if (locks === 0) previousOverflow = document.documentElement.style.overflow;
  locks++;
  document.documentElement.style.overflow = "hidden";
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks--;
    if (locks === 0) document.documentElement.style.overflow = previousOverflow;
  };
}
