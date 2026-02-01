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
      // Start pipeline
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

      // Connect to SSE for progress updates
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
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        paddingTop: '60px'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{
            fontSize: '48px',
            fontWeight: 'bold',
            color: 'white',
            marginBottom: '10px'
          }}>
            🎬 Proof
          </h1>
          <p style={{ fontSize: '20px', color: 'rgba(255,255,255,0.9)' }}>
            Autonomous Social Proof Engine
          </p>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', marginTop: '10px' }}>
            Transform customer reviews into high-converting video testimonials
          </p>
        </div>

        {/* Main Card */}
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '40px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          {/* Input Form */}
          <div style={{ marginBottom: '30px' }}>
            <label style={{
              display: 'block',
              marginBottom: '10px',
              fontSize: '16px',
              fontWeight: '600',
              color: '#333'
            }}>
              Company Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g., Acme Corporation"
              disabled={loading}
              style={{
                width: '100%',
                padding: '15px',
                fontSize: '16px',
                border: '2px solid #e0e0e0',
                borderRadius: '10px',
                outline: 'none',
                transition: 'border 0.3s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
            />
          </div>

          {/* Start Button */}
          <button
            onClick={startPipeline}
            disabled={loading}
            style={{
              width: '100%',
              padding: '15px',
              fontSize: '18px',
              fontWeight: '600',
              color: 'white',
              background: loading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '10px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'transform 0.2s',
              marginBottom: '20px'
            }}
            onMouseEnter={(e) => !loading && (e.target.style.transform = 'scale(1.02)')}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            {loading ? '🔄 Processing...' : '🚀 Generate Video Testimonials'}
          </button>

          {/* Progress Display */}
          {progress && (
            <div style={{
              padding: '20px',
              background: '#f0f4ff',
              borderRadius: '10px',
              marginBottom: '20px',
              borderLeft: '4px solid #667eea'
            }}>
              <div style={{
                fontSize: '14px',
                color: '#667eea',
                fontWeight: '600',
                marginBottom: '8px'
              }}>
                Progress
              </div>
              <div style={{ fontSize: '16px', color: '#333' }}>
                {progress}
              </div>
              {loading && (
                <div style={{
                  marginTop: '15px',
                  height: '6px',
                  background: '#e0e0e0',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, #667eea, #764ba2)',
                    animation: 'progress 2s infinite'
                  }} />
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div style={{
              padding: '20px',
              background: '#fff0f0',
              borderRadius: '10px',
              marginBottom: '20px',
              borderLeft: '4px solid #f44336'
            }}>
              <div style={{
                fontSize: '14px',
                color: '#f44336',
                fontWeight: '600',
                marginBottom: '8px'
              }}>
                Error
              </div>
              <div style={{ fontSize: '16px', color: '#333' }}>
                {error}
              </div>
            </div>
          )}

          {/* Video Display */}
          {videoUrl && (
            <div style={{
              padding: '20px',
              background: '#f0fff4',
              borderRadius: '10px',
              borderLeft: '4px solid #4caf50'
            }}>
              <div style={{
                fontSize: '14px',
                color: '#4caf50',
                fontWeight: '600',
                marginBottom: '15px'
              }}>
                ✅ Pipeline Complete!
              </div>
              <div style={{
                padding: '15px',
                background: 'white',
                borderRadius: '8px',
                marginBottom: '15px',
                border: '1px solid #e0e0e0'
              }}>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                  <strong>Video Generation:</strong>
                </div>
                <div style={{ fontSize: '13px', color: '#333' }}>
                  🎤 ElevenLabs voice generation: Ready<br/>
                  🎬 Grok video generation: Ready<br/>
                  💾 Video URL: <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: '3px', fontSize: '12px' }}>{videoUrl}</code>
                </div>
              </div>
              <div style={{
                fontSize: '13px',
                color: '#666',
                marginBottom: '15px',
                padding: '12px',
                background: '#fff9e6',
                borderRadius: '6px',
                border: '1px solid #ffe082'
              }}>
                💡 <strong>Note:</strong> The actual video file will be generated using your ElevenLabs and Grok API keys.
                This demo shows the complete pipeline working. To see real video generation, the APIs would create
                a 30-45 second video with professional voiceover and visuals.
              </div>
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  padding: '12px 24px',
                  background: '#4caf50',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  transition: 'background 0.3s',
                  marginRight: '10px'
                }}
                onMouseEnter={(e) => e.target.style.background = '#45a049'}
                onMouseLeave={(e) => e.target.style.background = '#4caf50'}
              >
                🔗 Open Video URL
              </a>
              <button
                onClick={() => {
                  setVideoUrl(null);
                  setProgress('');
                  setCompanyName('');
                }}
                style={{
                  display: 'inline-block',
                  padding: '12px 24px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.3s'
                }}
                onMouseEnter={(e) => e.target.style.background = '#5568d3'}
                onMouseLeave={(e) => e.target.style.background = '#667eea'}
              >
                ✨ Generate Another
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: '30px',
          color: 'rgba(255,255,255,0.8)',
          fontSize: '14px'
        }}>
          <p>Powered by PDD • ElevenLabs • Grok • Cerebras • Rtrvr</p>
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
