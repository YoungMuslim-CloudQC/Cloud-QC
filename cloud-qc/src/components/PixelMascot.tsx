/** The pixel mascot that fronts the error and not-found pages, doing a slow
 *  idle bob with a shadow that squashes underneath it.
 *
 *  The sprite itself is a static file (public/pixel-karim.png) drawn as a CSS
 *  background rather than an <img>: if the file is ever missing the block
 *  just renders empty instead of showing a broken-image icon on the one page
 *  whose whole job is to look composed when something has gone wrong. */
export function PixelMascot() {
  return (
    <div className="oops-sprite" aria-hidden="true">
      <div className="oops-sprite-shadow" />
      <div className="oops-sprite-img" />
    </div>
  );
}
