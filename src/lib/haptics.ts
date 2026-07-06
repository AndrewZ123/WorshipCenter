import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const lightHaptic = async () => {
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // No-op on web
  }
};

export const mediumHaptic = async () => {
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    // No-op on web
  }
};

export const heavyHaptic = async () => {
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch {
    // No-op on web
  }
};

export const successHaptic = async () => {
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    // No-op on web
  }
};

export const errorHaptic = async () => {
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch {
    // No-op on web
  }
};
