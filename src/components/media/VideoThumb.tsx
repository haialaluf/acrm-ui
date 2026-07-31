/** Still frame standing in for a video file.
 *
 *  A bare `<video>` is a poor thumbnail: it paints whatever frame decodes
 *  first, and a video that opens on a fade gives a flat white or black
 *  rectangle that reads as "nothing loaded". Seeking a little way in once the
 *  duration is known is enough to land on actual picture — the same reason
 *  Finder's thumbnails are not frame 0 either. */
export default function VideoThumb({
  url,
  className,
  onMeta,
}: {
  url: string;
  className?: string;
  /** Natural pixel dimensions of the video, once metadata has loaded. */
  onMeta?: (width: number, height: number) => void;
}) {
  return (
    <video
      src={url}
      muted
      playsInline
      // Metadata alone gives us the duration; the seek then fetches just the
      // one frame we display.
      preload="metadata"
      className={className}
      onLoadedMetadata={(e) => {
        const video = e.currentTarget;
        onMeta?.(video.videoWidth, video.videoHeight);
        if (Number.isFinite(video.duration) && video.duration > 0) {
          video.currentTime = video.duration * 0.25;
        }
      }}
    />
  );
}
