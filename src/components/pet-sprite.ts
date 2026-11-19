export function openPetSheets(canvas: HTMLCanvasElement) {
  const painter = canvas.getContext("2d");
  if (!painter) return null;
  const atlases = new Map<string, HTMLImageElement>();
  let previousSource = "";
  let previousFrame = -1;

  function preload(source: string) {
    if (atlases.has(source)) return;
    const atlas = new Image();
    atlas.src = source;
    atlases.set(source, atlas);
  }

  return {
    draw(source: string, next: string, phase: number) {
      for (const key of atlases.keys()) if (key !== source && key !== next) atlases.delete(key);
      preload(source);
      preload(next);
      const atlas = atlases.get(source);
      if (!atlas?.complete || !atlas.naturalWidth) return false;
      const index = Math.min(15, Math.floor(phase * 16));
      if (source === previousSource && index === previousFrame) return true;
      const width = atlas.naturalWidth / 4;
      const height = atlas.naturalHeight / 4;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      painter.clearRect(0, 0, width, height);
      painter.drawImage(atlas, index % 4 * width, Math.floor(index / 4) * height, width, height, 0, 0, width, height);
      previousSource = source;
      previousFrame = index;
      canvas.dataset.frame = String(index);
      canvas.dataset.source = source;
      return true;
    },
  };
}
