// The version comes from package.json, so bump it there (npm version patch|minor).
import pkg from '../package.json';

export const VERSION = pkg.version;
