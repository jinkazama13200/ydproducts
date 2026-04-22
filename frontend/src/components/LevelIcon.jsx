import React from 'react';
import { motion } from 'framer-motion';
import { HOT_VIDEO, WARM_VIDEO, IDLE_VIDEO } from '../utils/levels';

export function LevelIcon({ n, showLabel = false, videoEnabled = false }) {
  const level = n >= 10 ? 'hot' : n >= 3 ? 'warm' : 'idle';
  const emoji = n >= 10 ? '🔥' : n >= 3 ? '🟢' : '⚪';

  // Emoji-first: show emoji by default, video only when explicitly enabled
  if (!videoEnabled) {
    return (
      <motion.span
        className={`level-indicator ${level}`}
        role="img"
        aria-label={`${level} level`}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      >
        {emoji} {showLabel && <span className="level-text">{level.charAt(0).toUpperCase() + level.slice(1)}</span>}
      </motion.span>
    );
  }

  // Video mode: try video, fallback to emoji on error
  const videoSrc = level === 'hot'
    ? HOT_VIDEO
    : level === 'warm'
    ? WARM_VIDEO
    : IDLE_VIDEO;

  return (
    <VideoOrEmoji videoSrc={videoSrc} emoji={emoji} level={level} showLabel={showLabel} />
  );
}

function VideoOrEmoji({ videoSrc, emoji, level, showLabel }) {
  const [failed, setFailed] = React.useState(false);

  if (failed) {
    return (
      <motion.span
        className={`level-indicator ${level}`}
        role="img"
        aria-label={`${level} level`}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      >
        {emoji} {showLabel && <span className="level-text">{level.charAt(0).toUpperCase() + level.slice(1)}</span>}
      </motion.span>
    );
  }

  return (
    <motion.span
      className={`level-indicator ${level}`}
      role="img"
      aria-label={`${level} level`}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
    >
      <video className={`${level}-gif`} src={videoSrc} autoPlay muted loop playsInline onError={() => setFailed(true)} />
      {showLabel && <span className="level-text">{level.charAt(0).toUpperCase() + level.slice(1)}</span>}
    </motion.span>
  );
}

export default LevelIcon;