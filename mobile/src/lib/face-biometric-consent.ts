import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "pal_face_biometric_consent_accepted_v1";

export async function hasAcceptedFaceBiometricConsent(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(STORAGE_KEY);
    return v === "1";
  } catch {
    return false;
  }
}

export async function setFaceBiometricConsentAccepted(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, "1");
}
