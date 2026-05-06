import { MemoryKV } from '../memory-kv';

import { runAtomicKVStoreComplianceTests } from './compliance';

// reuse a single instance so all factory() calls share the same backing store
const kv = new MemoryKV();
runAtomicKVStoreComplianceTests(() => kv);
