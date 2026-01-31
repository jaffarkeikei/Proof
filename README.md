# Proof: Autonomous Social Proof Engine

**Version:** 1.0 Demo
**Status:** Hackathon MVP

## Overview

Proof is an autonomous AI agent pipeline that transforms customer reviews into high-converting marketing content at scale. The system discovers reviews across the web, obtains customer permission, generates platform-specific video testimonials, and distributes them automatically.

## Features

- **Automated Review Discovery**: Scrapes reviews from G2, Trustpilot, Reddit, and Twitter/X using Rtrvr.ai
- **AI-Powered Analysis**: Ranks reviews by conversion potential using Cerebras inference
- **Permission Management**: SMS consent workflow via Twilio
- **Multi-Format Video Generation**: Creates 3-5 video variations per testimonial using ElevenLabs (voice) and Grok (video)
- **Automated Distribution**: Posts content to social platforms via Toolhouse.ai
- **Real-Time Dashboard**: Visual pipeline progress with Server-Sent Events

## Architecture

### Backend (Node.js/Express)
- **Config Module**: Environment variable validation
- **Logger**: Structured Winston logging
- **Database**: SQLite with better-sqlite3 for pipeline state
- **Validation**: Zod schemas for type-safe data validation

### Agents (Sequential Pipeline)
1. **Discovery Agent**: Rtrvr.ai integration for review scraping
2. **Analysis Agent**: Cerebras LLM for review ranking and quote extraction
3. **Permission Agent**: Twilio SMS for customer consent
4. **Generation Agent**: ElevenLabs + Grok for video creation
5. **Distribution Agent**: Toolhouse.ai for social media posting

### Frontend (Next.js 15)
- **App Router**: Modern Next.js architecture
- **Dashboard Page**: Pipeline control and progress visualization
- **Pipeline Component**: Real-time stage status display
- **VideoCard Component**: Video preview and management

### API Endpoints
- `POST /api/pipeline/start` - Start pipeline execution
- `GET /api/pipeline/:runId/status` - Get pipeline status
- `GET /api/pipeline/:runId/sse` - Real-time progress stream

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Node.js, Express.js |
| Frontend | Next.js 15, React, TypeScript |
| Database | SQLite (better-sqlite3) |
| Validation | Zod |
| Logging | Winston |
| Web Scraping | Rtrvr.ai API |
| AI Inference | Cerebras API |
| Voice Synthesis | ElevenLabs API |
| Video Generation | Grok API (xAI) |
| SMS | Twilio API |
| Social Posting | Toolhouse.ai API |

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- API keys for: Rtrvr, Cerebras, ElevenLabs, Grok, Twilio, Toolhouse

## Installation

1. Clone the repository:
```bash
git clone https://github.com/jaffarkeikei/Proof.git
cd Proof
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env and add your API keys
```

4. Create required directories:
```bash
mkdir -p storage/videos storage/audio logs
```

## Running Locally

### Development Mode (Backend + Frontend)
```bash
npm run dev
```

This starts:
- Backend API server on http://localhost:3001
- Next.js frontend on http://localhost:3000

### Backend Only
```bash
npm run dev:backend
```

### Frontend Only
```bash
npm run dev:frontend
```

### Production Mode
```bash
npm run build
npm start
npm run start:frontend
```

## Usage

1. Open http://localhost:3000 in your browser
2. Enter a company name or URL
3. Click "Start Pipeline"
4. Watch real-time progress as agents execute:
   - Discovery: Scraping reviews
   - Analysis: Ranking and extracting quotes
   - Permission: Sending SMS consent requests (optional)
   - Generation: Creating video variations
   - Distribution: Posting to social platforms
5. Preview generated videos in the dashboard
6. Download or share videos as needed

## Project Structure

```
/
├── src/
│   ├── agents/
│   │   ├── discovery.js      # Rtrvr integration
│   │   ├── analysis.js       # Cerebras integration
│   │   ├── permission.js     # Twilio integration
│   │   ├── generation.js     # ElevenLabs + Grok
│   │   └── distribution.js   # Toolhouse integration
│   ├── api/
│   │   └── routes.js         # Express API endpoints
│   ├── pipeline/
│   │   └── orchestrator.js   # Pipeline coordination
│   ├── utils/
│   │   ├── config.js         # Environment config
│   │   ├── logger.js         # Winston logging
│   │   ├── database.js       # SQLite operations
│   │   └── validation.js     # Zod schemas
│   └── server.js             # Express app entry point
├── app/
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Dashboard page
│   └── components/
│       ├── Pipeline.tsx      # Pipeline visualizer
│       └── VideoCard.tsx     # Video preview card
├── storage/                  # Generated content
│   ├── videos/
│   └── audio/
├── architecture.json         # PDD architecture definition
├── package.json
├── .env.example
└── README.md
```

## Development Workflow

This project uses **Prompt Driven Development (PDD)** with Claude Code:

1. Architecture defined in `architecture.json`
2. Generate prompts: `pdd generate`
3. Sync code: `pdd sync <module_name>`
4. Iterate and refine

## Performance Goals

- Pipeline execution: < 60 seconds end-to-end
- Review discovery: < 10 seconds
- AI analysis: < 5 seconds (Cerebras fast inference)
- Video generation: < 30 seconds per variation
- Distribution: < 5 seconds per platform

## Demo Flow (5 Minutes)

**Minute 1:** Introduce problem - "Companies have 100s of reviews but only use 1-2"

**Minute 2:** Enter company name → Show live scraping (Rtrvr)

**Minute 3:** AI analyzes and generates 3 video variations in 30 seconds

**Minute 4:** Auto-post one video to LinkedIn (Toolhouse action)

**Minute 5:** Show analytics + "This ran autonomously while I was talking"

## Known Limitations (MVP)

- Single company per run (no batch processing)
- No authentication (demo only)
- SQLite database (not production-ready)
- Local file storage for videos
- Manual approval required for distribution
- Limited error recovery

## Future Enhancements

- Multi-company management
- Advanced video editing capabilities
- Payment processing integration
- Cloud storage for media files
- Webhook support for async processing
- Analytics dashboard with engagement metrics
- A/B testing for video variations

## Troubleshooting

### API Errors
- Verify all API keys in `.env`
- Check API rate limits and quotas
- Review logs in `logs/` directory

### Database Issues
- Delete `proof.db` to reset database
- Check file permissions on storage directories

### Video Generation Slow
- Grok API may be rate limited
- Consider reducing video variations (5 → 3)
- Check network connectivity

## License

MIT

## Contributing

This is a hackathon demo project. For production use, please review security, scalability, and error handling requirements.

## Support

For issues or questions:
- GitHub Issues: https://github.com/jaffarkeikei/Proof/issues
- Documentation: See architecture.json for module details
