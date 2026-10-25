import { ensureSession } from '../../../../data/auth';
import { isConfigured } from '../../../../data/config';

/** The learner when this deploy has no Supabase or the device is offline: attempts stay on the device under it. */
export const DEVICE_LEARNER = 'local';

/** The take store's player id (decision Q12: the same id as takes), made anonymously if there is none yet. */
export async function learnerId(): Promise<string> {
  if (!isConfigured()) return DEVICE_LEARNER;
  try {
    return (await ensureSession()).user_id;
  } catch {
    return DEVICE_LEARNER;
  }
}
