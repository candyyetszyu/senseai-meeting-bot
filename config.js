require('dotenv').config();

module.exports = {
  // Lark App Configuration
  lark: {
    appId: process.env.LARK_APP_ID,
    appSecret: process.env.LARK_APP_SECRET,
    // Bitable for storing thoughts (required for thoughts feature)
    bitableAppToken: process.env.LARK_BITABLE_APP_TOKEN,
    thoughtsTableId: process.env.LARK_THOUGHTS_TABLE_ID,
    verificationToken: process.env.WEBHOOK_VERIFICATION_TOKEN,
  },

  // AI Configuration
  ai: {
    provider: process.env.AI_PROVIDER || 'openai',
    openaiApiKey: process.env.OPENAI_API_KEY,
    huggingfaceToken: process.env.HF_TOKEN || process.env.HUGGINGFACE_API_TOKEN,
  },

  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
  },

  // Document Permissions
  // Control who can access meeting documents
  documents: {
    // Default permission level for created documents
    // Options: 'private' (only creator), 'organization' (anyone in org), 'public' (anyone with link)
    defaultAccess: process.env.DOCUMENT_DEFAULT_ACCESS || 'private',
    
    // Whether to share documents with transcript sender automatically
    shareWithSender: process.env.DOCUMENT_SHARE_WITH_SENDER !== 'false', // default: true
  },

  // Meeting Note Templates
  templates: {
    'daily-standup': {
      name: 'Daily Standup',
      prompt: 'Extract from the meeting transcript: 1) What each person did yesterday, 2) What they plan to do today, 3) Any blockers. Format as a structured list with sections for Team Updates and Action Items.',
      exampleTranscript: `Daily Standup - January 29, 2026

Alice: Good morning team! Yesterday I completed the user authentication module and fixed the login bug. Today I'm going to start working on the dashboard UI. No blockers for me.

Bob: Hey everyone! Yesterday I finished the API integration for the payment system and wrote unit tests. Today I'll be reviewing Alice's authentication PR and then starting on the notification service. I'm blocked on getting access to the staging environment.

Charlie: Morning! Yesterday I completed the database migration and optimized the query performance. Today I'm planning to work on the admin panel and help Bob with the staging access. No blockers.

David: Hi team! Yesterday I finished the documentation for the new API endpoints. Today I'll be working on the mobile app integration. Need design specs for the new screens.`,
      exampleOutput: `## 👥 Team Updates

### Alice
- ** Yesterday: ** Completed user authentication module, fixed login bug
- ** Today: ** Start dashboard UI development
- ** Blockers: ** None

### Bob
- ** Yesterday: ** Finished payment API integration, wrote unit tests
- ** Today: ** Review authentication PR, start notification service
- ** Blockers: ** Need staging environment access

### Charlie
- ** Yesterday: ** Completed database migration, optimized queries
- ** Today: ** Work on admin panel, help Bob with staging access
- ** Blockers: ** None

### David
- ** Yesterday: ** Finished API documentation
- ** Today: ** Mobile app integration
- ** Blockers: ** Need design specs for new screens


## 🚧 Action Items

- [ ] ** Charlie **: Grant Bob staging environment access
- [ ] ** Design Team **: Provide mobile screen specs to David
- [ ] ** Bob **: Review Alice's authentication PR`,
    },
    'brainstorming': {
      name: 'Brainstorming Session',
      prompt: 'Summarize all ideas discussed in the meeting. Group similar ideas together by category, highlight the most promising ones with ⭐, and include priority rankings and action items.',
      exampleTranscript: `Brainstorming Session: New Feature Ideas - January 29, 2026

Alice: I think we should add a dark mode. Users have been requesting it for months.

Bob: Great idea! We could also add customizable themes, not just dark mode.

Charlie: I like that. What about adding collaborative features? Like real-time editing for shared documents.

Alice: Yes! And we could add commenting and @mentions.

David: Those are good. I'd also suggest adding an AI assistant to help users with common tasks.

Bob: The AI idea is interesting. We could start with simple suggestions and gradually make it smarter.

Charlie: We should also think about mobile. Maybe a companion app?

Alice: Mobile is important. But let's prioritize - I think dark mode and themes would be easiest to implement quickly.

David: Agreed. AI assistant would take longer but has high impact.

Bob: What about analytics? Users might want to track their usage and productivity.

Charlie: Good point. Let's group these and vote on priorities.`,
      exampleOutput: `## 💡 Ideas Generated

### UI/UX Enhancements
1. ** Dark Mode ** ⭐ (High Priority)
   - Most requested feature
   - Relatively quick to implement
   - Suggested by: Alice

2. ** Customizable Themes ** ⭐
   - Extension of dark mode
   - Allows personalization
   - Suggested by: Bob

### Collaboration Features
3. ** Real-time Collaborative Editing **
   - Enable multiple users to edit simultaneously
   - Suggested by: Charlie

4. ** Commenting & @Mentions **
   - Improve team communication
   - Suggested by: Alice

### AI & Automation
5. ** AI Assistant ** ⭐ (High Impact)
   - Help with common tasks
   - Start simple, evolve over time
   - Suggested by: David, Bob

### Analytics
6. ** Usage & Productivity Tracking **
   - Help users understand their patterns
   - Suggested by: Bob

### Mobile
7. ** Mobile Companion App **
   - Extend platform accessibility
   - Suggested by: Charlie


## 🎯 Priority Rankings

** Quick Wins (Implement First): **
- Dark Mode & Customizable Themes

** High Impact (Plan Next): **
- AI Assistant

** Future Consideration: **
- Real-time collaboration
- Mobile app
- Analytics dashboard


## 📋 Next Steps

1. Create design mockups for dark mode & themes
2. Research AI assistant integration options
3. Conduct user survey to validate priorities
4. Set up project timelines for top 3 features`,
    },
    'kickoff': {
      name: 'Project Kickoff',
      prompt: 'Extract: 1) Project goals and objectives, 2) Timeline and milestones, 3) Team roles and responsibilities, 4) Key deliverables, 5) Action items, 6) Success metrics. Format with clear sections and emoji headers.',
      exampleTranscript: `Project Kickoff: Customer Portal Redesign - January 29, 2026

Project Manager: Welcome everyone! Today we're kicking off the Customer Portal Redesign project. Let me outline our goals.

The main objective is to improve user experience and increase customer engagement by 30%. We want to modernize the interface and add self-service features.

Alice (Design Lead): I'll be leading the design effort. We'll conduct user research first, then create new mockups.

Bob (Tech Lead): I'll handle the technical architecture. We're planning to use React and migrate to a microservices backend.

Charlie (QA Lead): I'll set up the testing strategy and coordinate with both design and dev.

Project Manager: Our timeline is 12 weeks. Week 1-2: Research and planning. Week 3-4: Design. Week 5-10: Development. Week 11-12: Testing and launch.

Key deliverables include: New UI designs, updated API, comprehensive test suite, and migration plan.

Bob: What about the database migration?

Project Manager: Good question. That's part of the technical architecture work. Bob, you'll need to coordinate with the DevOps team.

Alice: Do we have a user research budget?

Project Manager: Yes, we have budget for 20 user interviews and usability testing sessions.

Charlie: I'll need access to the staging environment by week 4.

Project Manager: Noted. Any other questions? Great. Let's meet weekly for status updates. First checkpoint is in two weeks.`,
      exampleOutput: `## 🎯 Project Goals

### Primary Objective
Improve user experience and increase customer engagement by 30%

### Key Initiatives
- Modernize the user interface
- Add self-service features for customers
- Improve overall platform performance


## 👥 Team & Roles

### Project Manager
- Overall project coordination
- Weekly status meetings
- Resource allocation

### Alice - Design Lead
- User research (20 interviews + usability testing)
- UI/UX mockup creation
- Design system documentation

### Bob - Tech Lead
- Technical architecture (React + microservices)
- Database migration strategy
- DevOps coordination

### Charlie - QA Lead
- Testing strategy development
- Quality coordination with design & dev
- Staging environment setup


## 📅 Timeline (12 Weeks)

** Weeks 1-2: Research & Planning **
- User research
- Technical planning
- Requirements finalization

** Weeks 3-4: Design **
- UI mockups
- Design reviews
- User testing

** Weeks 5-10: Development **
- Frontend implementation
- Backend API updates
- Database migration

** Weeks 11-12: Testing & Launch **
- Comprehensive testing
- Bug fixes
- Production deployment


## 📦 Key Deliverables

1. New UI Designs
2. Updated API architecture
3. Comprehensive test suite
4. Database migration plan
5. User documentation


## 📋 Action Items

- [ ] ** Bob **: Coordinate with DevOps team on database migration
- [ ] ** Alice **: Schedule 20 user research interviews
- [ ] ** Charlie **: Set up staging environment access by Week 4
- [ ] ** All **: Prepare for first checkpoint in 2 weeks


## 📊 Success Metrics

- 30% increase in customer engagement
- Reduced support tickets
- Improved user satisfaction scores`,
    },
    'retrospective': {
      name: 'Sprint Retrospective',
      prompt: 'Organize feedback into clear sections: 1) What went well (with who mentioned it), 2) What could be improved (with details), 3) Specific action items for next sprint with owners. Use emoji headers and structured formatting.',
      exampleTranscript: `Sprint 24 Retrospective - January 29, 2026

Facilitator: Let's start with what went well this sprint.

Alice: I think our code review process was much better. We caught bugs earlier.

Bob: Agreed. Also, the daily standups were more focused and shorter.

Charlie: The new testing framework saved us a lot of time. We found issues faster.

David: Communication with the product team improved. We had clearer requirements.

Facilitator: Great! Now, what could we improve?

Alice: We had too many meetings. Three of them could have been emails.

Bob: The staging environment was down twice. It blocked our testing.

Charlie: We underestimated the complexity of the payment integration. We should buffer our estimates more.

David: Documentation was rushed at the end. We need to do it incrementally.

Facilitator: What specific actions should we take next sprint?

Alice: Let's have a "no meeting Wednesday" to get focused work time.

Bob: I'll work with DevOps to improve staging reliability. Maybe add monitoring.

Charlie: Let's add 25% buffer to all our estimates, especially for third-party integrations.

David: I propose we document as we code, not at the end. Make it part of our definition of done.

Facilitator: Excellent. Any other concerns? No? Alright, let's make these changes and see how sprint 25 goes!`,
      exampleOutput: `## ✅ What Went Well

### Process Improvements
- ** Better code review process **
  - Catching bugs earlier in the cycle
  - Mentioned by: Alice

- ** More focused daily standups **
  - Shorter and more effective meetings
  - Mentioned by: Bob

### Technical Wins
- ** New testing framework **
  - Faster issue identification
  - Significant time savings
  - Mentioned by: Charlie

### Communication
- ** Improved product team collaboration **
  - Clearer requirements
  - Better alignment
  - Mentioned by: David


## 🔴 What Could Be Improved

### Meeting Overhead
- Too many unnecessary meetings
- Three meetings could have been emails
- Mentioned by: Alice

### Infrastructure Issues
- Staging environment downtime (2 incidents)
- Blocked testing progress
- Mentioned by: Bob

### Estimation Accuracy
- Underestimated payment integration complexity
- Need better estimation practices
- Mentioned by: Charlie

### Documentation
- Documentation rushed at sprint end
- Quality suffered due to time pressure
- Mentioned by: David


## 🎯 Action Items for Next Sprint

### 1. "No Meeting Wednesday"
- ** Owner: ** Alice
- ** Goal: ** Provide focused work time
- ** Implementation: ** Block Wednesdays for deep work

### 2. Improve Staging Reliability
- ** Owner: ** Bob
- ** Goal: ** Prevent environment downtime
- ** Implementation: ** Add monitoring, coordinate with DevOps

### 3. Buffer Estimates by 25%
- ** Owner: ** Charlie (Team-wide)
- ** Goal: ** More accurate sprint planning
- ** Focus: ** Especially for third-party integrations

### 4. Continuous Documentation
- ** Owner: ** David (Team-wide)
- ** Goal: ** Better documentation quality
- ** Implementation: ** Add to Definition of Done, document while coding


## 📊 Sprint Metrics Reminder

Track these in Sprint 25:
- Meeting time reduction
- Staging uptime percentage
- Estimation accuracy
- Documentation completeness`,
    },
    'general': {
      name: 'General Meeting',
      prompt: 'Create clear, structured notes from this meeting transcript including: 1) Key discussion points with context, 2) Decisions made with rationale, 3) Action items with owners and deadlines, 4) Follow-up required. Use emoji headers and professional formatting.',
      exampleTranscript: `Product Strategy Meeting - January 29, 2026

Sarah (CEO): Thanks everyone for joining. We need to discuss our Q1 strategy and make some key decisions.

First, let's talk about our target market. Marketing data shows our enterprise segment is growing 40% faster than SMB.

Mike (CTO): That's interesting. Our infrastructure can support enterprise scale, but we'd need to add SSO and advanced security features.

Sarah: Exactly. The question is: should we double down on enterprise or maintain our dual focus?

Jennifer (Head of Sales): From a sales perspective, enterprise deals are larger but take 6 months to close. SMB deals close in 2-3 weeks.

Mike: There's also the technical consideration. Enterprise features are complex and would require significant engineering resources.

Sarah: Let's look at the numbers. Enterprise average deal is $50K annually. SMB average is $5K.

Jennifer: But we close 10 SMB deals for every enterprise deal.

Mike: So similar revenue but different resource allocation.

Sarah: Here's what I'm thinking. Let's prioritize enterprise features for Q1, but not abandon SMB. We can hire two more engineers specifically for enterprise.

Mike: That works. We'd need to start recruiting immediately.

Jennifer: I'll need two more enterprise sales reps too.

Sarah: Agreed. Jennifer, please prepare the hiring plan. Mike, draft the technical roadmap. We'll review both next week.

Also, one more thing - our Series B fundraising. The lead investor wants to see 100% year-over-year growth. We need to hit $10M ARR by end of Q2.

Mike: That's aggressive but achievable with the enterprise focus.

Sarah: Good. Let's make it happen. Meeting adjourned.`,
      exampleOutput: `## 🎯 Key Discussion Points

### Market Analysis
- Enterprise segment growing 40% faster than SMB
- Current infrastructure can support enterprise scale
- Additional features needed: SSO, advanced security

### Business Model Comparison

** Enterprise: **
- Average deal: $50K/year
- Sales cycle: 6 months
- Complex technical requirements

** SMB: **
- Average deal: $5K/year
- Sales cycle: 2-3 weeks
- Simpler requirements
- Higher volume (10x enterprise)


## ✅ Decisions Made

### 1. Q1 Strategic Focus
** Decision: ** Prioritize enterprise features while maintaining SMB support

** Rationale: **
- Similar revenue potential
- Better long-term scalability
- Aligns with growth metrics

### 2. Team Expansion
** Hiring Plan: **
- 2 additional engineers (enterprise features)
- 2 additional enterprise sales reps
- Immediate recruitment start


## 📋 Action Items

### Sarah (CEO)
- [ ] Review hiring plan from Jennifer
- [ ] Review technical roadmap from Mike
- [ ] Follow-up meeting scheduled: Next week

### Mike (CTO)
- [ ] Draft enterprise technical roadmap
- [ ] Include SSO and security features
- [ ] Identify engineering talent requirements
- [ ] Due: Next week

### Jennifer (Head of Sales)
- [ ] Prepare detailed hiring plan
- [ ] Define enterprise sales rep requirements
- [ ] Create recruitment timeline
- [ ] Due: Next week


## 🎯 Key Targets

### Q2 Revenue Goal
- Target: $10M ARR
- Growth: 100% YoY
- Required for: Series B fundraising
- Lead investor requirement


## 📊 Follow-up Required

- Review session scheduled for next week
- Hiring plans for engineering and sales
- Technical roadmap for enterprise features
- Series B preparation timeline`,
    },
  },
};
