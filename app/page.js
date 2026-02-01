'use client';

import { useState } from 'react';

export default function Home() {
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState(null);
  const [runId, setRunId] = useState(null);

  const startPipeline = async () => {
    if (!companyName.trim()) {
      setError('Please enter a company name');
      return;
    }

    setLoading(true);
    setError(null);
    setProgress('Starting pipeline...');
    setVideoUrl(null);

    try {
      const response = await fetch('http://localhost:3000/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start pipeline');
      }

      setRunId(data.runId);

      const eventSource = new EventSource(`http://localhost:3000/api/pipeline/${data.runId}/progress`);

      eventSource.onmessage = (event) => {
        const update = JSON.parse(event.data);
        setProgress(update.message);

        if (update.status === 'completed') {
          setVideoUrl(update.videoUrl);
          setLoading(false);
          eventSource.close();
        } else if (update.status === 'error') {
          setError(update.error);
          setLoading(false);
          eventSource.close();
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
      };

    } catch (err) {
      setError(err.message);
      setLoading(false);
      setProgress('');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h1 style={{
            fontSize: '56px',
            fontWeight: '700',
            color: 'white',
            marginBottom: '16px',
            letterSpacing: '-1px'
          }}>
            Proof
          </h1>
          <p style={{
            fontSize: '20px',
            color: 'rgba(255,255,255,0.95)',
            fontWeight: '400'
          }}>
            Autonomous Social Proof Engine
          </p>
        </div>

        {/* Main Card */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '48px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          {/* Input Form */}
          <div style={{ marginBottom: '32px' }}>
            <label style={{
              display: 'block',
              marginBottom: '12px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#1a1a1a',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Company Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Enter company name"
              disabled={loading}
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '16px',
                border: '2px solid #e8e8e8',
                borderRadius: '8px',
                outline: 'none',
                transition: 'all 0.2s',
                boxSizing: 'border-box',
                background: loading ? '#f5f5f5' : 'white'
              }}
            />
          </div>

          {/* Button */}
          <button
            onClick={startPipeline}
            disabled={loading}
            style={{
              width: '100%',
              padding: '18px',
              fontSize: '16px',
              fontWeight: '600',
              color: 'white',
              background: loading ? '#cccccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              marginBottom: '32px'
            }}
          >
            {loading ? 'Processing...' : 'Generate Video'}
          </button>

          {/* Progress */}
          {progress && (
            <div style={{
              padding: '20px',
              background: '#f8f9fa',
              borderRadius: '8px',
              marginBottom: '24px',
              border: '1px solid #e8e8e8'
            }}>
              <div style={{
                fontSize: '13px',
                color: '#666',
                fontWeight: '600',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Status
              </div>
              <div style={{
                fontSize: '15px',
                color: '#1a1a1a',
                fontWeight: '500'
              }}>
                {progress}
              </div>
              {loading && (
                <div style={{
                  marginTop: '16px',
                  height: '4px',
                  background: '#e8e8e8',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: '100%',
                    background: 'linear-gradient(90deg, #667eea, #764ba2)',
                    animation: 'progress 1.5s infinite'
                  }} />
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: '20px',
              background: '#fff5f5',
              borderRadius: '8px',
              marginBottom: '24px',
              border: '1px solid #feb2b2'
            }}>
              <div style={{
                fontSize: '13px',
                color: '#c53030',
                fontWeight: '600',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Error
              </div>
              <div style={{ fontSize: '15px', color: '#1a1a1a' }}>
                {error}
              </div>
            </div>
          )}

          {/* Video Result */}
          {videoUrl && (
            <div style={{
              padding: '24px',
              background: '#f0fdf4',
              borderRadius: '8px',
              border: '1px solid #86efac'
            }}>
              <div style={{
                fontSize: '13px',
                color: '#166534',
                fontWeight: '600',
                marginBottom: '16px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Complete
              </div>

              <video
                controls
                autoPlay
                style={{
                  width: '100%',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  background: '#000'
                }}
                src={videoUrl}
              />

              <div style={{
                display: 'flex',
                gap: '12px'
              }}>
                <a
                  href={videoUrl}
                  download
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: '#22c55e',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                    fontSize: '14px'
                  }}
                >
                  Download Video
                </a>
                <button
                  onClick={() => {
                    setVideoUrl(null);
                    setProgress('');
                    setCompanyName('');
                    setRunId(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '14px'
                  }}
                >
                  Generate Another
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: '32px',
          color: 'rgba(255,255,255,0.7)',
          fontSize: '13px'
        }}>
          Powered by Prompt Driven Development
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
