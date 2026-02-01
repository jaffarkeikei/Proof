# Proof - Hackathon Submission

## Elevator Pitch
Proof transforms customer reviews into authentic video testimonials in under 2 minutes using AI. Enter a company name, and watch as we scrape real reviews, generate professional voiceovers, and create 8-second testimonial videos - all fully autonomous.

---

## Inspiration
Social proof drives conversions, but most companies can't afford professional video testimonials. We saw an opportunity to democratize this using AI - specifically, to build it using **Prompt Driven Development (PDD)**, where prompts are the source of truth and AI generates production-ready code. Could we build a complete autonomous video generation engine in 90 minutes? We tried.

---

## What it does
1. **Scrapes real reviews** from Google/Yelp using RTRVR API (sponsor)
2. **Analyzes sentiment** and picks the best testimonial
3. **Researches the company** using GPT-4o enhanced with Toolhouse (sponsor)
4. **Generates voiceover** with ElevenLabs text-to-speech
5. **Creates 8-second video** with OpenAI Sora
6. **Delivers downloadable MP4** - ready to use on landing pages

Total time: 40-110 seconds. Zero human intervention.

---

## How we built it

**Prompt Driven Development (PDD)**:
- Generated 1,200 lines of core video agent code from prompts
- Architecture automatically designed from GitHub issue
- Prompts as source of truth, code as compilation target

**Sponsor API Integration**:
- **RTRVR**: Real review scraping (81% success rate, $0.002/page)
- **Toolhouse**: Enhanced AI research with web search tools

**Tech Stack**:
- Frontend: Next.js 15 with Server-Sent Events for real-time progress
- Backend: Express.js orchestrating multi-agent pipeline
- Database: SQLite with better-sqlite3
- APIs: ElevenLabs (voice), OpenAI Sora (video), RTRVR (scraping), Toolhouse (AI tools)

**Development Speed**:
- 90 minutes total build time
- $16.57 total cost
- 5,599 lines of code (1,200 PDD-generated, rest manual)

---

## Challenges we ran into

1. **Sora API quirks**: Discovered `seconds` parameter must be string `"8"` not integer `8` - learned through trial and error

2. **Database schema constraints**: Videos require scripts, scripts require reviews - had to understand PDD-generated foreign key relationships

3. **RTRVR integration**: Had to design robust fallback system (RTRVR → GPT-4o → template) to handle API variability

4. **Real-time progress**: SSE implementation for streaming pipeline updates while video generates in background

5. **PDD trust**: Learning to trust AI-generated code without manually rewriting everything - the generated video agent works perfectly

---

## Accomplishments that we're proud of

1. **Working end-to-end in 90 minutes**: From idea to deployed autonomous pipeline

2. **Real sponsor API integration**: Not just using them superficially - RTRVR actually scrapes real reviews, Toolhouse actually enhances research

3. **Production-ready PDD code**: 1,200 lines of video generation code that handles ElevenLabs + Sora integration, retries, error handling - all generated from prompts

4. **8-second videos that actually work**: Real voiceovers, company-specific content, downloadable MP4s

5. **$16.57 to build entire system**: Proved PDD economics - generated complex code for fraction of traditional development cost

---

## What we learned

**Technical**:
- PDD is real and works for production code - not just demos
- AI-generated code can handle complex API integrations (ElevenLabs, Sora)
- Sponsor APIs (RTRVR, Toolhouse) provide genuine value - not just marketing
- Sora can generate decent 8s testimonial videos when given good context

**Process**:
- Trust the generated code first, debug second
- Hybrid approach works: PDD for complex modules, manual for simple glue code
- Real-time progress (SSE) is critical for long-running AI operations
- Database schema from PDD needs understanding, not rewriting

**AI Development**:
- Prompts are powerful source of truth
- AI can generate production-grade error handling and retries
- Cost efficiency: $16.57 for system that would take days manually

---

## What's next for Proof

**Short-term**:
- Add multi-angle videos (problem/solution/transformation)
- Permission workflow (SMS consent via Twilio)
- Batch processing for enterprise customers

**Technical**:
- Longer videos (Sora supports up to 12s)
- Custom voice cloning (ElevenLabs Professional Voice)
- Direct Trustpilot/Yelp API integration (supplement RTRVR)

**Business**:
- SaaS pricing: $29/video or $199/month unlimited
- White-label for agencies
- Landing page builder integration

**PDD Evolution**:
- Open-source our PDD prompts
- Build more modules using PDD (email outreach, social posting)
- Prove PDD can scale to 50k+ line codebases

---

## Built with

**Languages & Frameworks**:
- JavaScript (ES6+)
- Node.js 18+
- Next.js 15 (React 18)
- Express.js

**AI APIs**:
- OpenAI Sora 2 (video generation)
- OpenAI GPT-4o (research, review generation)
- ElevenLabs (text-to-speech voiceovers)
- **RTRVR** (AI web scraping) - Sponsor API ⭐
- **Toolhouse** (AI agent tools) - Sponsor API ⭐

**Infrastructure**:
- Vercel (frontend hosting)
- Railway (backend hosting)
- SQLite with better-sqlite3 (database)

**Development Tools**:
- **Prompt Driven Development (PDD)** - Core methodology
- Claude Opus via LiteLLM (code generation)
- Git/GitHub
- Winston (structured logging)
- Zod (validation)

**Other APIs**:
- Twilio (SMS for permissions - future)
- Cerebras (fast inference - future)

**Total Stack**: 7 APIs, 3 platforms, 2 sponsor integrations, 1 radical development methodology

---

**Cost to Build**: $16.57
**Time to Build**: 90 minutes
**Lines of Code**: 5,599
**Videos Generated**: Infinite ♾️

---

Built for **500 Global Hackathon** | January 31, 2026
