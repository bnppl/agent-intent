import { setDefaultTimeout, setWorldConstructor, World } from '@cucumber/cucumber';
export class IntentWorld extends World {}
setWorldConstructor(IntentWorld);
setDefaultTimeout(20000);
