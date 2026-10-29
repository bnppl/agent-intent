import { After, setDefaultTimeout, setWorldConstructor, World } from '@cucumber/cucumber';
import type { Revision } from '../src/core/types.js';
import type { RepositoryDriver } from './support/repository-driver.js';
export class IntentWorld extends World { driver?: RepositoryDriver; oldRevision?: Revision; }
setWorldConstructor(IntentWorld);
setDefaultTimeout(20000);
After(async function (this: IntentWorld) { await this.driver?.close(); });
