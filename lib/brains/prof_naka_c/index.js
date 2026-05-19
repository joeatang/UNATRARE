/**
 * NAKAMOJO — Main Brain Module
 */

import roleConfig from './roleConfig.js';
import { scan, fulfill, log, sendTo, isReady, markResponded } from './functions.js';

export function shouldRespond(text, meta = {}) {
  if (!isReady()) return false;
  const result = scan(text, meta);
  return result.signal > 0.15;
}

export function handleMessage(text, meta = {}) {
  const scanResult = scan(text, meta);
  const response = fulfill(text, scanResult);
  markResponded();
  log('respond', { signal: scanResult.signal, angle: scanResult.angle });
  return { scan: scanResult, response, brain: roleConfig.id };
}

export { roleConfig, scan, fulfill, log, sendTo };
export default { shouldRespond, handleMessage, roleConfig, scan, fulfill, log, sendTo };
