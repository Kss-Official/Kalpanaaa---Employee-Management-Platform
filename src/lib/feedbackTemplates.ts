import { FeedbackCategory } from '../types';

export interface FeedbackTemplateConfig {
  category: FeedbackCategory;
  title: string;
  badge: string;
  tagline: string;
  theme: {
    accent: string;
    border: string;
    bg: string;
    text: string;
    pillBg: string;
    iconColor: string;
  };
  field1: {
    label: string;
    placeholder: string;
    helper: string;
  };
  field2: {
    label: string;
    placeholder: string;
    helper: string;
  };
  actionItems: {
    label: string;
    placeholder: string;
    helper: string;
  };
  quickPresets: {
    title: string;
    strengths: string;
    improvements: string;
    actions: string[];
  }[];
}

export const FEEDBACK_TEMPLATES: Record<FeedbackCategory, FeedbackTemplateConfig> = {
  'Performance & Sprint Delivery': {
    category: 'Performance & Sprint Delivery',
    title: 'Sprint Execution & Milestone Delivery',
    badge: 'Delivery Velocity',
    tagline: 'Review feature completions, sprint commitments, velocity, and delivery speed.',
    theme: {
      accent: 'blue',
      border: 'border-blue-500/30',
      bg: 'bg-blue-500/5',
      text: 'text-blue-400',
      pillBg: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
      iconColor: 'text-blue-400'
    },
    field1: {
      label: 'Key Deliverables & Milestones Achieved',
      placeholder: 'e.g. Delivered offline PWA sync engine 2 days ahead of sprint deadline, resolved 14 backlog tickets with zero regressions...',
      helper: 'Specific sprint deliverables, on-time milestones, and high-impact accomplishments.'
    },
    field2: {
      label: 'Execution Speed & Blocker Management',
      placeholder: 'e.g. Improve sprint capacity estimation on complex database tasks, flag technical blockers during daily standups earlier...',
      helper: 'Opportunities to accelerate sprint turnaround and streamline task execution.'
    },
    actionItems: {
      label: 'Sprint Goals & Milestone Next Steps',
      placeholder: 'e.g. Complete Milestone 3.2 release candidate, optimize build time',
      helper: 'Measurable deliverables for the upcoming sprint cycle.'
    },
    quickPresets: [
      {
        title: '🚀 High-Velocity Sprint Delivery',
        strengths: 'Outstanding execution and delivery velocity. Shipped all committed sprint epics with high accuracy and minimal revision cycles.',
        improvements: 'Ensure PR reviews are prioritized in the first half of the sprint to prevent end-of-sprint testing crunches.',
        actions: ['Lead sprint burndown check during mid-week standup', 'Finalize stage 2 feature handoff']
      },
      {
        title: '🎯 Roadmap Milestone Achiever',
        strengths: 'Consistently meets project milestones and proactively unblocks teammates when dependencies arise.',
        improvements: 'Provide more granular time estimates during sprint planning for backend integration subtasks.',
        actions: ['Break down large Jira/Kanban tasks into sub-4hr tickets', 'Document sprint demo deliverables']
      }
    ]
  },

  'Technical & Code Quality': {
    category: 'Technical & Code Quality',
    title: 'Architecture & Engineering Standards',
    badge: 'Code Quality & System Design',
    tagline: 'Review code modularity, automated test coverage, system design, and zero-defect quality.',
    theme: {
      accent: 'cyan',
      border: 'border-cyan-500/30',
      bg: 'bg-cyan-500/5',
      text: 'text-cyan-400',
      pillBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
      iconColor: 'text-cyan-400'
    },
    field1: {
      label: 'Technical Strengths & Clean Architecture',
      placeholder: 'e.g. Excellent component modularity in TypeScript, robust error-handling in API layers, and optimized bundle size...',
      helper: 'Clean coding practices, modular design, performance optimizations, and technical acumen.'
    },
    field2: {
      label: 'Engineering Standards & Test Coverage Focus',
      placeholder: 'e.g. Increase automated unit test coverage across async state transitions, enforce strict typing over any casts...',
      helper: 'Areas to strengthen test coverage, refactoring, and engineering robustness.'
    },
    actionItems: {
      label: 'Engineering Quality & Refactoring Goals',
      placeholder: 'e.g. Write integration test suite for biometric store, refactor legacy utility',
      helper: 'Actionable technical milestones and code quality improvements.'
    },
    quickPresets: [
      {
        title: '⚡ Clean Architecture & Zero Regressions',
        strengths: 'Exceptional code structure and design patterns. Writes self-documenting code with comprehensive TypeScript interfaces.',
        improvements: 'Increase automated integration test coverage across edge-case network recovery scenarios.',
        actions: ['Add Vitest/Jest unit tests for offline sync handlers', 'Lead code review guidelines for team']
      },
      {
        title: '🛡️ Performance & Memory Optimization',
        strengths: 'Sub-100ms API response optimizations and zero memory leaks. Demonstrates deep understanding of front-to-back performance.',
        improvements: 'Standardize error handling format across all microservice API endpoints.',
        actions: ['Document API contracts in OpenAPI/Swagger', 'Audit dependencies for bundle size reduction']
      }
    ]
  },

  'Behavioral & Teamwork': {
    category: 'Behavioral & Teamwork',
    title: 'Culture, Collaboration & Mentorship',
    badge: 'Team Dynamics & Ownership',
    tagline: 'Review cross-functional communication, standup transparency, empathy, and team mentorship.',
    theme: {
      accent: 'purple',
      border: 'border-purple-500/30',
      bg: 'bg-purple-500/5',
      text: 'text-purple-400',
      pillBg: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
      iconColor: 'text-purple-400'
    },
    field1: {
      label: 'Collaboration, Ownership & Team Culture',
      placeholder: 'e.g. Highly collaborative team player, clear daily standup communication, always willing to mentor junior developers...',
      helper: 'Interpersonal strengths, proactive communication, empathy, and positive team energy.'
    },
    field2: {
      label: 'Cross-Functional & Stakeholder Growth',
      placeholder: 'e.g. Ensure earlier escalation of external blockers, foster closer collaboration with UI/UX design during wireframe phases...',
      helper: 'Opportunities to strengthen stakeholder alignment and communication breadth.'
    },
    actionItems: {
      label: 'Team Engagement & Culture Action Steps',
      placeholder: 'e.g. Host bi-weekly engineering knowledge sharing session',
      helper: 'Actionable steps to elevate collaboration, teamwork, and mentorship.'
    },
    quickPresets: [
      {
        title: '🤝 Supportive Peer & Mentor',
        strengths: 'A cornerstone of team morale. Actively reviews peer pull requests with constructive feedback and mentors onboarding members.',
        improvements: 'Encourage sharing learnings with wider organization through internal tech talks.',
        actions: ['Host 1 internal knowledge-share session this month', 'Pair-program with junior engineer on sprint module']
      },
      {
        title: '💬 Proactive Communicator',
        strengths: 'Maintains crystal-clear visibility into project status. Stakeholders are always kept informed of progress and milestones.',
        improvements: 'Document meeting takeaways and action items in shared project workspace promptly.',
        actions: ['Publish weekly progress highlights to PM dashboard', 'Follow up on cross-team dependencies early']
      }
    ]
  },

  'Appreciation & Recognition': {
    category: 'Appreciation & Recognition',
    title: 'Kudos, Heroics & Excellence Award',
    badge: 'Special Commendation',
    tagline: 'Formally recognize outstanding contributions, exceptional initiative, and extraordinary impact.',
    theme: {
      accent: 'amber',
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/5',
      text: 'text-amber-400',
      pillBg: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
      iconColor: 'text-amber-400'
    },
    field1: {
      label: 'Outstanding Contribution & Notable Impact',
      placeholder: 'e.g. Stepped up during the critical staging deployment to resolve a severe issue with zero client downtime...',
      helper: 'Describe the exemplary initiative, problem-solving heroics, or standout milestone.'
    },
    field2: {
      label: 'Organizational Value & Leadership Potential',
      placeholder: 'e.g. Demonstrated executive readiness and ownership. Strong candidate for expanded project leadership scope...',
      helper: 'Longer-term career growth, leadership trajectories, and future potential.'
    },
    actionItems: {
      label: 'Recognition Rewards & Growth Trajectory',
      placeholder: 'e.g. Spotlight in company all-hands, nominate for quarterly excellence bonus',
      helper: 'Next steps for career expansion, recognition spotlights, and leadership roles.'
    },
    quickPresets: [
      {
        title: '🏆 Above and Beyond Heroics',
        strengths: 'Went the extra mile during critical release window, exhibiting exceptional dedication and ownership under pressure.',
        improvements: 'Ensure healthy work-life pacing and delegate operational subtasks to fellow engineers.',
        actions: ['Spotlight recognition in upcoming company All-Hands', 'Eligible for quarterly excellence award']
      },
      {
        title: '🌟 High-Impact Innovation Kudos',
        strengths: 'Designed and shipped an innovative solution that dramatically improved system efficiency and user satisfaction.',
        improvements: 'Prepare to lead the architectural design for the upcoming Q4 enterprise expansion.',
        actions: ['Present architectural blueprint to leadership', 'Take technical ownership of Q4 flagship initiative']
      }
    ]
  }
};
