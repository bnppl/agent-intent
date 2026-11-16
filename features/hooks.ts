import { setDefaultTimeout, setDefinitionFunctionWrapper, setWorldConstructor, World } from '@cucumber/cucumber';
import { withStepEvidence } from './support/evidence.js';
export class IntentWorld extends World {}
setWorldConstructor(IntentWorld);
setDefinitionFunctionWrapper(withStepEvidence);
setDefaultTimeout(20000);
