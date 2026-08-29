// The complete SH360 survey instrument
// All 30 questions, 7 sections, open text prompts

const SECTIONS = [
  {
    id: 'honor',
    number: 1,
    title: 'Honor',
    subtitle: 'Treating people with equal respect and genuine regard, regardless of role, background, or relationship.',
    framework: 'H.O.M.E.S. — Honor  ·  Integrity Code Ch.1  ·  SHIP Value 2',
    questions: [
      { n: 1,  text: 'I treat every person on my team with equal respect, regardless of their role, tenure, or background.' },
      { n: 2,  text: 'I ensure all perspectives are genuinely heard — not just those from the most senior or vocal members of the team.' },
      { n: 3,  text: 'I build meaningful relationships across the organization, including with people outside my direct sphere of influence.' },
      { n: 4,  text: 'I make each person I work with feel valued, seen, and genuinely important to the team\'s success.' },
    ],
    openText: 'What additional feedback do you have about how this leader treats and values the people around them?'
  },
  {
    id: 'own',
    number: 2,
    title: 'Own',
    subtitle: 'Taking full accountability for decisions and their impact — on results and on people. Acting with proactivity and transparency.',
    framework: 'H.O.M.E.S. — Own  ·  Integrity Code Ch.1 (Act Based on Truth)  ·  SHIP Values 3 & 2',
    questions: [
      { n: 5,  text: 'I take full accountability for my decisions — including their impact on people, not just outcomes.' },
      { n: 6,  text: 'When something goes wrong, I focus on what I can learn and improve rather than looking for who to blame.' },
      { n: 7,  text: 'I proactively identify problems and take action before situations escalate.' },
      { n: 8,  text: 'I follow through on every commitment I make to my team — my word is reliable.' },
      { n: 9,  text: 'I keep my team informed by sharing relevant information promptly and transparently.' },
    ],
    openText: 'What additional feedback do you have about this leader\'s accountability, follow-through, and ownership?'
  },
  {
    id: 'model',
    number: 3,
    title: 'Model',
    subtitle: 'Living the standard I hold others to. Consistency between what I say and what I do.',
    framework: 'H.O.M.E.S. — Model  ·  Integrity Code Ch.1 (Work Fairly and Transparently)  ·  SHIP Value 5',
    questions: [
      { n: 10, text: 'My daily behavior is consistent with the standards and values I expect from those around me.' },
      { n: 11, text: 'There is no gap between what I say and what I do — I lead by example in all situations, not just visible ones.' },
      { n: 12, text: 'I act with fairness and transparency, even when it would be easier or more convenient not to.' },
      { n: 13, text: 'When I make a mistake, I acknowledge it openly and use it as an opportunity to grow rather than moving past it quietly.' },
    ],
    openText: 'What additional feedback do you have about how consistently this leader walks the talk?'
  },
  {
    id: 'empower',
    number: 4,
    title: 'Empower',
    subtitle: 'Creating the conditions for people to speak up, think independently, and act with confidence.',
    framework: 'H.O.M.E.S. — Empower  ·  Integrity Code Ch.1 (Safe Workplace)  ·  SHIP Value 2',
    questions: [
      { n: 14, text: 'My team feels genuinely safe to speak up, share concerns, and disagree with me — without fear of negative consequences.' },
      { n: 15, text: 'When my team brings ideas or concerns, I listen to understand rather than to respond.' },
      { n: 16, text: 'I delegate real ownership of meaningful work and provide the context and support people need to succeed.' },
      { n: 17, text: 'When someone challenges my thinking or pushes back on a decision, I respond in a way that encourages more of it.' },
      { n: 18, text: 'People can see their input visibly shaping decisions — contributing on my team consistently leads to impact.' },
    ],
    openText: 'What additional feedback do you have about the environment this leader creates for their team?'
  },
  {
    id: 'strengthen',
    number: 5,
    title: 'Strengthen',
    subtitle: 'Actively investing in the growth and capability of the people around me.',
    framework: 'H.O.M.E.S. — Strengthen  ·  Japan 360 (Talent Development)  ·  SHIP Value 2',
    questions: [
      { n: 19, text: 'I invest intentional time in the development of each person on my team — growth conversations happen regularly, not just at review time.' },
      { n: 20, text: 'I know the career goals of my direct reports and actively take steps to support their progress.' },
      { n: 21, text: 'I identify and develop internal talent, building a bench of capable people for future leadership roles.' },
      { n: 22, text: 'The feedback I give is specific, timely, and genuinely useful — not just evaluative.' },
      { n: 23, text: 'I coach my team toward greater independence, helping people build their own capability rather than always solving problems for them.' },
    ],
    openText: 'What additional feedback do you have about how this leader develops and invests in their people?'
  },
  {
    id: 'strategic',
    number: 6,
    title: 'Strategic Leadership & Innovation',
    subtitle: 'Thinking ahead, driving change, and connecting the team\'s work to a larger purpose.',
    framework: 'Japan 360 (Strategic Thinking, Judgment)  ·  SHIP Values 1 & 3',
    questions: [
      { n: 24, text: 'I think ahead — I anticipate how changes in the business environment will affect my team and adjust before I have to.' },
      { n: 25, text: 'I connect my team\'s daily work to a compelling vision they understand and feel motivated by.' },
      { n: 26, text: 'I actively challenge the status quo and drive meaningful innovation in how we work and the value we create.' },
      { n: 27, text: 'I make well-timed decisions using the best available information rather than waiting for certainty that may never come.' },
    ],
    openText: 'What additional feedback do you have about this leader\'s strategic thinking, judgment, or approach to innovation?'
  },
  {
    id: 'values',
    number: 7,
    title: 'Living Our Values',
    subtitle: 'Whether a leader\'s daily conduct reflects the character and purpose of Sekisui House.',
    framework: 'Integrity Code (Love of Humanity, Truth & Trust)  ·  SHIP Value 5  ·  Global Vision',
    questions: [
      { n: 28, text: 'This leader consistently does what is right, even when it would be easier or more convenient to look the other way.' },
      { n: 29, text: 'This leader treats customers, team members, and business partners with the same genuine care and respect — not differently based on what they need from them.' },
      { n: 30, text: 'When I think about the way this leader carries themselves in this organization, I would be proud to have our customers see it.' },
    ],
    openText: 'What additional feedback do you have about how this leader\'s character and conduct reflect who we are as an organization?'
  }
];

// For display: rater group labels
const RATER_GROUP_LABELS = {
  self:          'Self',
  supervisor:    'Supervisor',
  peer:          'Peer',
  direct_report: 'Direct Report',
  skip_level:    'Skip-Level'
};

// Rating scale labels
const SCALE_LABELS = {
  1: 'Strongly Disagree',
  2: 'Disagree',
  3: 'Neither Agree nor Disagree',
  4: 'Agree',
  5: 'Strongly Agree'
};

module.exports = { SECTIONS, RATER_GROUP_LABELS, SCALE_LABELS };
