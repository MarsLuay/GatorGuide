// scripts/scorecard_test.js
// Quick test harness to validate College Scorecard API calls outside the app.
// Usage: set EXPO_PUBLIC_COLLEGE_SCORECARD_KEY and EXPO_PUBLIC_USE_STUB_DATA in env, then run `node scripts/scorecard_test.js`

const fetch = global.fetch || require('node-fetch');

const API_BASE = 'https://api.data.gov/ed/collegescorecard/v1';
const apiKey = process.env.EXPO_PUBLIC_COLLEGE_SCORECARD_KEY || 'STUB';
const useStubEnv = process.env.EXPO_PUBLIC_USE_STUB_DATA;
const isStubMode = typeof useStubEnv === 'string' ? useStubEnv === 'true' : false;

const buildUrl = (params) => {
  // Ensure we append /schools to the Scorecard base URL without dropping the base path
  const base = API_BASE.replace(/\/$/, '') + '/schools';
  const u = new URL(base);
  Object.entries({ ...params, api_key: apiKey, keys_nested: 'true' }).forEach(([k, v]) => u.searchParams.set(k, v));
  return u.toString();
};

const redactKey = (url) => url.replace(/api_key=[^&]+/, 'api_key=REDACTED');

const timeoutFetch = (url, ms = 8000) => {
  return Promise.race([
    fetch(url),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
};

(async () => {
  console.log('isStubMode():', isStubMode);
  console.log('API key status:', apiKey === 'STUB' ? 'STUB' : 'SET');

  if (isStubMode || apiKey === 'STUB') {
    console.log('Running in stub mode or no key set; skipping network calls.');
    return;
  }

  try {
    // 1) searchColleges("Washington")
    const fields = [
      'id', 'school.name', 'school.city', 'school.state', 'latest.admissions.admission_rate.overall', 'latest.student.size', 'latest.cost.tuition.in_state'
    ].join(',');
    const searchParams = { fields, per_page: '5', 'school.name': 'Washington' };
    const searchUrl = buildUrl(searchParams);
    console.log('\nSearch URL:', redactKey(searchUrl));
    const res1 = await timeoutFetch(searchUrl);
    console.log('Search HTTP status:', res1.status);
    const json1 = await res1.json();
    console.log('Search metadata.total, page, per_page:', json1.metadata?.total, json1.metadata?.page, json1.metadata?.per_page);
    console.log('Search results.length:', (json1.results || []).length);
    if ((json1.results || []).length > 0) {
      const first = json1.results[0];
      console.log('First result id, name:', first.id, first.school?.name);
      const firstId = first.id;

      // 2) getCollegeDetails(firstId)
      const detailFields = [
        'id', 'school.name', 'school.city', 'school.state', 'school.school_url', 'latest.admissions.admission_rate.overall', 'latest.student.size', 'latest.cost.tuition.in_state', 'latest.cost.tuition.out_of_state'
      ].join(',');
      const detailParams = { fields: detailFields, id: String(firstId), per_page: '1' };
      const detailUrl = buildUrl(detailParams);
      console.log('\nDetails URL:', redactKey(detailUrl));
      const res2 = await timeoutFetch(detailUrl);
      console.log('Details HTTP status:', res2.status);
      const json2 = await res2.json();
      console.log('Details metadata.total, page, per_page:', json2.metadata?.total, json2.metadata?.page, json2.metadata?.per_page);
      console.log('Details results.length:', (json2.results || []).length);
      if ((json2.results || []).length > 0) {
        const r = json2.results[0];
        console.log('Details first id, name:', r.id, r.school?.name);
      }
    }

    // 3) getMatches({}) - simple list
    const matchFields = fields;
    const matchParams = { fields: matchFields, per_page: '5' };
    const matchUrl = buildUrl(matchParams);
    console.log('\nMatches URL:', redactKey(matchUrl));
    const res3 = await timeoutFetch(matchUrl);
    console.log('Matches HTTP status:', res3.status);
    const json3 = await res3.json();
    console.log('Matches metadata.total, page, per_page:', json3.metadata?.total, json3.metadata?.page, json3.metadata?.per_page);
    console.log('Matches results.length:', (json3.results || []).length);
    if ((json3.results || []).length > 0) {
      const r = json3.results[0];
      console.log('Matches first id, name:', r.id, r.school?.name);
    }

  } catch (err) {
    console.error('Error during API checks:', err);
  }
})();
