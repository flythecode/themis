/**
 * Themis Paywall — Free/Pro логика, лимиты
 */
import { storage } from './storage.js';

export function checkCanSend() {
  if (storage.isPro()) return { ok: true };
  return storage.bumpUsage();
}

export function getProStatus() {
  return {
    isPro: storage.isPro(),
    usage: storage.getUsage()
  };
}
