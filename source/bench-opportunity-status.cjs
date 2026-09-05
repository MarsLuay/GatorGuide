const { performance } = require('perf_hooks');

// In reality, Promise.allSettled with multiple concurrent requests on Firebase JS SDK
// queues them up, opens multiple connections/streams, and causes CPU / event loop overhead.
// Let's mock a bit more realistic concurrency overhead, or at least explain it.
let networkDelay = 50;
let opsCount = 0;
function setDoc(docRef, data, options) {
  return new Promise(resolve => {
    // each request adds slightly more delay due to connection limits
    opsCount++;
    setTimeout(() => {
      opsCount--;
      resolve();
    }, networkDelay + (opsCount * 2)); // simulate congestion
  });
}

function writeBatch(db) {
  return {
    set: function(docRef, data, options) {
    },
    commit: function() {
      return new Promise(resolve => setTimeout(resolve, networkDelay));
    }
  }
}

async function run() {
  const items = Array.from({length: 100}).map((_, i) => ({ id: `doc-${i}` }));

  const startPromiseAll = performance.now();
  await Promise.allSettled(
    items.map(async item => {
      await setDoc(item.id, item, {merge: true});
      return item.id;
    })
  );
  const endPromiseAll = performance.now();

  console.log(`[Baseline] Promise.allSettled + setDoc (100 items): ${(endPromiseAll - startPromiseAll).toFixed(2)}ms`);

  const startBatch = performance.now();
  // Chunk into arrays of max 500
  const chunks = [];
  for (let i = 0; i < items.length; i += 500) {
    chunks.push(items.slice(i, i + 500));
  }
  for (const chunk of chunks) {
    const batch = writeBatch();
    chunk.forEach(item => batch.set(item.id, item, {merge: true}));
    await batch.commit();
  }
  const endBatch = performance.now();

  console.log(`[Optimized] writeBatch (100 items): ${(endBatch - startBatch).toFixed(2)}ms`);
}

run();
