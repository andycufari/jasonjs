// node --import ./tests/unit/support/alias-loader.mjs <test>
import { register } from 'node:module';
register('./alias-hooks.mjs', import.meta.url);
