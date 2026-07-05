import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayer } from '../store';

const format = (seconds = 0) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export default function AudioPlayer({ tracks }) {
  const audio = useRef(null);
  const requestId = useRef(0);
  const { currentTrack, isPlaying, setTrack, setPlaying } = usePlayer();
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!audio.current) {
      audio.current = new Audio();
      audio.current.preload = 'metadata';
    }
    const el = audio.current;
    const update = () => setProgress(el.currentTime);
    const onMetadata = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    const onEnded = () => { setPlaying(false); setProgress(0); };
    const onError = () => {
      setNotice('真实歌曲音源暂时不可用，请稍后再试。');
      setPlaying(false);
      setLoading(false);
    };
    el.addEventListener('timeupdate', update);
    el.addEventListener('loadedmetadata', onMetadata);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);
    return () => {
      requestId.current += 1;
      el.pause();
      setPlaying(false);
      el.removeEventListener('timeupdate', update);
      el.removeEventListener('loadedmetadata', onMetadata);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
    };
  }, [setPlaying]);

  const choose = useCallback(async function choose(track) {
    const el = audio.current;
    if (!el) return;

    if (currentTrack?.id === track.id && el.src) {
      if (!el.paused) { el.pause(); setPlaying(false); }
      else {
        if (el.ended) el.currentTime = 0;
        try { await el.play(); setPlaying(true); }
        catch (error) {
          console.warn('[audio] resume failed:', error.name, error.message);
          setNotice('真实歌曲音源暂时不可用，请稍后再试。');
        }
      }
      return;
    }

    const activeRequest = ++requestId.current;
    setTrack(track);
    setProgress(0);
    setDuration(0);
    setLoading(true);
    setNotice('正在连接真实歌曲音源…');
    el.pause();
    el.src = `/api/tracks/${track.id}/audio`;
    el.currentTime = 0;
    el.load();

    try {
      await el.play();
      if (requestId.current !== activeRequest) return;
      setPlaying(true);
      setNotice('正在播放真实歌曲试听音源');
    } catch (error) {
      if (requestId.current !== activeRequest) return;
      console.warn('[audio] initial play failed:', error.name, error.message);
      setNotice('真实歌曲音源暂时不可用，请稍后再试。');
      setPlaying(false);
    } finally {
      if (requestId.current === activeRequest) setLoading(false);
    }
  }, [currentTrack, setTrack, setPlaying]);

  const active = tracks.find((track) => track.id === currentTrack?.id) || tracks[0];
  return (
    <section className="player-panel">
      <div className="now-playing">
        <button className="play-main" onClick={() => choose(active)} disabled={loading} aria-label={isPlaying ? '暂停' : '播放'}>
          {loading ? '···' : isPlaying ? 'Ⅱ' : '▶'}
        </button>
        <div><span className="eyebrow">NOW PLAYING</span><strong>{active.title}</strong><small>{notice || '选择曲目开始试听'}</small></div>
      </div>
      <div className="timeline">
        <span>{format(progress)}</span>
        <input aria-label="播放进度" type="range" min="0" max={duration || active.duration || 180} value={progress} onChange={(e) => { if (audio.current) { audio.current.currentTime = Number(e.target.value); setProgress(Number(e.target.value)); } }} />
        <span>{format(duration || active.duration)}</span>
      </div>
      <ol className="track-list">
        {tracks.map((track) => (
          <li key={track.id} className={currentTrack?.id === track.id ? 'active' : ''}>
            <button onClick={() => choose(track)}><span>{String(track.track_number).padStart(2, '0')}</span><strong>{track.title}</strong><time>{format(track.duration)}</time></button>
          </li>
        ))}
      </ol>
    </section>
  );
}
