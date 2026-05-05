const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/starter-opportunities.json', 'utf8'));

const grcQuarterDateDeadlines = [
  { school: 'green-river-college', quarter: 'Summer 2025', type: 'quarter-start', title: 'Summer Quarter Starts', date: '2025-07-01', termCode: '2255', recurring: false, sourceUrl: 'https://www.greenriver.edu/students/academics/academic-calendar.html' },
  { school: 'green-river-college', quarter: 'Summer 2025', type: 'quarter-end', title: 'Summer Quarter Ends', date: '2025-09-04', termCode: '2255', recurring: false, note: 'Using 10-week session end date.', sourceUrl: 'https://www.greenriver.edu/students/academics/academic-calendar.html' },
  { school: 'green-river-college', quarter: 'Fall 2025', type: 'quarter-start', title: 'Fall Quarter Starts', date: '2025-09-22', termCode: '2257', recurring: false, sourceUrl: 'https://www.greenriver.edu/students/academics/academic-calendar.html' },
  { school: 'green-river-college', quarter: 'Fall 2025', type: 'quarter-end', title: 'Fall Quarter Ends', date: '2025-12-11', termCode: '2257', recurring: false, sourceUrl: 'https://www.greenriver.edu/students/academics/academic-calendar.html' },
  { school: 'green-river-college', quarter: 'Winter 2026', type: 'quarter-start', title: 'Winter Quarter Starts', date: '2026-01-05', termCode: '2261', recurring: false, sourceUrl: 'https://www.greenriver.edu/students/academics/academic-calendar.html' },
  { school: 'green-river-college', quarter: 'Winter 2026', type: 'quarter-end', title: 'Winter Quarter Ends', date: '2026-03-25', termCode: '2261', recurring: false, sourceUrl: 'https://www.greenriver.edu/students/academics/academic-calendar.html' },
  { school: 'green-river-college', quarter: 'Spring 2026', type: 'quarter-start', title: 'Spring Quarter Starts', date: '2026-04-06', termCode: '2263', recurring: false, sourceUrl: 'https://www.greenriver.edu/students/academics/academic-calendar.html' },
  { school: 'green-river-college', quarter: 'Spring 2026', type: 'quarter-end', title: 'Spring Quarter Ends', date: '2026-06-22', termCode: '2263', recurring: false, sourceUrl: 'https://www.greenriver.edu/students/academics/academic-calendar.html' },
  { school: 'green-river-college', quarter: 'Summer 2026', type: 'quarter-start', title: 'Summer Quarter Starts', date: '2026-07-06', termCode: '2265', recurring: false, sourceUrl: 'https://www.greenriver.edu/students/academics/academic-calendar.html' },
  { school: 'green-river-college', quarter: 'Summer 2026', type: 'quarter-end', title: 'Summer Quarter Ends', date: '2026-09-10', termCode: '2265', recurring: false, note: 'Using 10-week session end date.', sourceUrl: 'https://www.greenriver.edu/students/academics/academic-calendar.html' },
  { school: 'green-river-college', quarter: 'Fall 2026', type: 'quarter-start', title: 'Fall Quarter Starts', date: '2026-09-21', termCode: '2267', recurring: false, sourceUrl: 'https://www.greenriver.edu/students/academics/academic-calendar.html' },
  { school: 'green-river-college', quarter: 'Fall 2026', type: 'quarter-end', title: 'Fall Quarter Ends', date: '2026-12-10', termCode: '2267', recurring: false, sourceUrl: 'https://www.greenriver.edu/students/academics/academic-calendar.html' },
  { school: 'green-river-college', quarter: 'Winter 2027', type: 'quarter-start', title: 'Winter Quarter Starts', date: '2027-01-04', termCode: '2271', recurring: false, sourceUrl: 'https://www.greenriver.edu/students/academics/academic-calendar.html' },
  { school: 'green-river-college', quarter: 'Winter 2027', type: 'quarter-end', title: 'Winter Quarter Ends', date: '2027-03-24', termCode: '2271', recurring: false, sourceUrl: 'https://www.greenriver.edu/students/academics/academic-calendar.html' },
  { school: 'green-river-college', quarter: 'Spring 2027', type: 'quarter-start', title: 'Spring Quarter Starts', date: '2027-04-05', termCode: '2273', recurring: false, sourceUrl: 'https://www.greenriver.edu/students/academics/academic-calendar.html' },
  { school: 'green-river-college', quarter: 'Spring 2027', type: 'quarter-end', title: 'Spring Quarter Ends', date: '2027-06-22', termCode: '2273', recurring: false, sourceUrl: 'https://www.greenriver.edu/students/academics/academic-calendar.html' },
  { school: 'green-river-college', quarter: 'Summer 2027', type: 'quarter-start', title: 'Summer Quarter Starts', date: '2027-07-06', termCode: '2275', recurring: false, sourceUrl: 'https://www.greenriver.edu/students/academics/academic-calendar.html' },
  { school: 'green-river-college', quarter: 'Summer 2027', type: 'quarter-end', title: 'Summer Quarter Ends', date: '2027-09-09', termCode: '2275', recurring: false, note: 'Using 10-week session end date.', sourceUrl: 'https://www.greenriver.edu/students/academics/academic-calendar.html' },
  { school: 'green-river-college', quarter: 'Fall 2027', type: 'quarter-start', title: 'Fall Quarter Starts', date: '2027-09-20', termCode: '2277', recurring: false, sourceUrl: 'https://www.greenriver.edu/students/academics/academic-calendar.html' },
  { school: 'green-river-college', quarter: 'Fall 2027', type: 'quarter-end', title: 'Fall Quarter Ends', date: '2027-12-09', termCode: '2277', recurring: false, sourceUrl: 'https://www.greenriver.edu/students/academics/academic-calendar.html' },
  { school: 'green-river-college', quarter: 'Winter 2028', type: 'quarter-start', title: 'Winter Quarter Starts', date: '2028-01-03', termCode: '2281', recurring: false, sourceUrl: 'https://www.greenriver.edu/students/academics/academic-calendar.html' },
  { school: 'green-river-college', quarter: 'Winter 2028', type: 'quarter-end', title: 'Winter Quarter Ends', date: '2028-03-22', termCode: '2281', recurring: false, sourceUrl: 'https://www.greenriver.edu/students/academics/academic-calendar.html' },
  { school: 'green-river-college', quarter: 'Spring 2028', type: 'quarter-start', title: 'Spring Quarter Starts', date: '2028-04-03', termCode: '2283', recurring: false, sourceUrl: 'https://www.greenriver.edu/students/academics/academic-calendar.html' },
  { school: 'green-river-college', quarter: 'Spring 2028', type: 'quarter-end', title: 'Spring Quarter Ends', date: '2028-06-16', termCode: '2283', recurring: false, sourceUrl: 'https://www.greenriver.edu/students/academics/academic-calendar.html' }
];

const newItems = grcQuarterDateDeadlines.map((item) => ({
  schemaVersion: 1,
  opportunityId: `grc-${item.type}-${item.termCode}`,
  type: item.type,
  status: "active",
  title: `${item.quarter} ${item.type === "quarter-start" ? "Starts" : "Ends"}`,
  organizationName: "Green River College",
  summary: item.note ? `${item.note} ${item.quarter} at Green River College.` : `Important date for ${item.quarter} at Green River College.`,
  externalUrl: item.sourceUrl,
  dueAt: `${item.date}T09:00:00.000Z`,
  recurrence: {
    isYearly: false,
    month: null,
    day: null,
    timezone: "America/Los_Angeles"
  },
  deadline: {
    type: "final",
    label: item.title
  },
  college: {
    collegeId: item.school,
    collegeName: "Green River College"
  },
  majors: [],
  tags: []
}));

const merged = [...data, ...newItems];
fs.writeFileSync('data/starter-opportunities.json', JSON.stringify(merged, null, 2) + '\n');
