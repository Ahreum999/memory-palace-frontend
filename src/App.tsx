import { useState, useEffect, useRef } from 'react';

// Replace with your actual SVG filename
import { ReactComponent as MySVG } from './ghost.svg';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

interface Line {
  text: string;
  source: string;
  extra?: string;
  image?: string;
  added?: string;
}

interface Batch {
  sentences: string[];
  source: string;
  image?: string;
  added?: string;
  id: number;
}

// Bold mother/mama/mommy in text
function BoldedText({ text }: { text: string }) {
  const pattern = /\b(mother(?:hood|ing|s)?|mama(?:s)?|mommy|maternal)\b/gi;
  const parts: { text: string; bold: boolean }[] = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    parts.push({ text: match[0], bold: true });
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), bold: false });
  }

  return (
    <>
      {parts.map((part, i) =>
        part.bold
          ? <strong key={i} style={{ fontWeight: 700 }}>{part.text}</strong>
          : <span key={i}>{part.text}</span>
      )}
    </>
  );
}

export default function App() {
  const [currentBatch, setCurrentBatch] = useState<Batch | null>(null);
  const [visible, setVisible] = useState(false);
  const poolRef = useRef<Batch[]>([]);
  const idRef = useRef(0);

  // Fetch and group into batches
  useEffect(() => {
    const fetchFeed = () => {
      fetch(`${API_URL}/feed`)
        .then(r => r.json())
        .then(data => {
          const lines: Line[] = data.lines;
          const batches: Batch[] = [];
          let i = 0;

          while (i < lines.length) {
            const current = lines[i];
            const next = lines[i + 1];

            if (next && next.source === current.source) {
              batches.push({
                sentences: [current.text, next.text],
                source: current.source,
                image: current.image || next.image,
                added: current.added || next.added,
                id: idRef.current++
              });
              i += 2;
            } else {
              batches.push({
                sentences: [current.text],
                source: current.source,
                image: current.image,
                added: current.added,
                id: idRef.current++
              });
              i += 1;
            }
          }

          poolRef.current = batches;
        })
        .catch(err => console.log('API error:', err));
    };

    fetchFeed();
    const hourly = setInterval(fetchFeed, 3600000);
    return () => clearInterval(hourly);
  }, []);

  // Drip one batch every 5.5 seconds
  useEffect(() => {
    let index = 0;

    const showNext = () => {
      const pool = poolRef.current;
      if (pool.length === 0) return;

      const batch = pool[index % pool.length];
      index++;

      setVisible(false);

      setTimeout(() => {
        setCurrentBatch(batch);
        setVisible(true);
      }, 600);
    };

    const initial = setTimeout(() => {
      showNext();
      const interval = setInterval(showNext, 5500);
      return () => clearInterval(interval);
    }, 800);

    return () => clearTimeout(initial);
  }, []);

  // Format timestamp as "Mar 12, 2026 · 3:42 PM"
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const date = d.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      });
      const time = d.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true
      });
      return `${date} · ${time}`;
    } catch {
      return '';
    }
  };

  return (
    <div style={styles.page}>

      {/* LEFT — SVG always visible */}
      <div style={styles.left}>
        <MySVG style={styles.svg} />
      </div>

      {/* RIGHT — Photo (if any) + text stacked */}
      <div style={styles.right}>
        <div style={{
          ...styles.batchWrap,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(12px)',
        }}>

          {/* Photo */}
          {currentBatch?.image && (
            <div style={styles.imageWrap}>
              <img
                src={currentBatch.image}
                alt=""
                style={styles.image}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Text sentences with bolded keywords */}
          {currentBatch?.sentences.map((sentence, i) => (
            <p key={i} style={styles.sentence}>
              <BoldedText text={sentence} />
            </p>
          ))}

          {/* Source + date/time tag */}
          {currentBatch && (
            <span style={styles.source}>
              {currentBatch.source}
              {currentBatch.added && (
                <> · {formatDate(currentBatch.added)}</>
              )}
            </span>
          )}

        </div>
      </div>

    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    backgroundColor: '#000',
    color: '#e8e8e0',
    height: '100vh',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    fontFamily: '"Courier New", Courier, monospace',
    padding: '60px',
    boxSizing: 'border-box',
    gap: '80px',
    overflow: 'hidden',
  },
  left: {
    flex: '0 0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    width: '280px',
    height: 'auto',
    opacity: 0.9,
  },
  right: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    height: '100%',
  },
  batchWrap: {
    transition: 'opacity 0.8s ease, transform 0.8s ease',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    maxWidth: '680px',
    width: '100%',
  },
  imageWrap: {
    width: '100%',
    maxHeight: '320px',
    overflow: 'hidden',
    borderRadius: '2px',
  },
  image: {
    width: '100%',
    height: '320px',
    objectFit: 'cover',
    display: 'block',
    opacity: 0.85,
  },
  sentence: {
    fontSize: '26px',
    lineHeight: '1.55',
    margin: 0,
    fontWeight: 'normal',
  },
  source: {
    fontSize: '10px',
    opacity: 0.25,
    letterSpacing: '0.3em',
    textTransform: 'uppercase',
    marginTop: '4px',
  },
};
