import { useCallback, useRef, useState } from "react";
import {
  hasAcceptedFaceBiometricConsent,
  setFaceBiometricConsentAccepted,
} from "../lib/face-biometric-consent";

/**
 * Shows the biometric consent modal once per device before opening the face camera
 * (registration, signup, attendance, or BLE verification).
 */
export function useFaceBiometricConsentGate() {
  const [consentVisible, setConsentVisible] = useState(false);
  const pendingOpenCameraRef = useRef<(() => void) | null>(null);

  const requestCameraAccess = useCallback((openCamera: () => void) => {
    void (async () => {
      if (await hasAcceptedFaceBiometricConsent()) {
        openCamera();
        return;
      }
      pendingOpenCameraRef.current = openCamera;
      setConsentVisible(true);
    })();
  }, []);

  const onConsentAgree = useCallback(() => {
    void setFaceBiometricConsentAccepted();
    setConsentVisible(false);
    const fn = pendingOpenCameraRef.current;
    pendingOpenCameraRef.current = null;
    fn?.();
  }, []);

  const onConsentDecline = useCallback(() => {
    setConsentVisible(false);
    pendingOpenCameraRef.current = null;
  }, []);

  return { consentVisible, requestCameraAccess, onConsentAgree, onConsentDecline };
}
