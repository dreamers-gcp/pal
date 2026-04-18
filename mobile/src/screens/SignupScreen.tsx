import { GoogleLogo } from "../components/GoogleLogo";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FaceCameraModal, type FaceCaptureResult } from "../components/FaceCameraModal";
import { NucleusWordmark } from "../components/NucleusWordmark";
import type { Session } from "@supabase/supabase-js";
import { getPalApiBaseUrl } from "../lib/config";
import { signInWithGoogleOAuth } from "../lib/google-oauth";
import { postFaceEmbedding, postFaceEmbeddingForSignup } from "../lib/face-api";
import {
  cosineSimilarity,
  FACE_REGISTRATION_MATCH_THRESHOLD,
  FACE_REGISTRATION_MAX_PHOTOS,
  FACE_REGISTRATION_MIN_PHOTOS,
} from "../lib/face-math";
import { arrayBufferFromLocalUri } from "../lib/image-uri";
import { uploadBufferToStorage } from "../lib/storage-upload";
import { mobileFieldError, normalizeTenDigitMobile } from "../lib/phone-normalize";
import { getSupabase } from "../lib/supabase";
import type { UserRole } from "../types";
import { theme } from "../theme";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "student", label: "Student" },
  { value: "professor", label: "Professor" },
  { value: "admin", label: "Admin" },
];

export type SignupFaceCapture = {
  uri: string;
  embedding: number[];
  /** In-memory JPEG (signup upload) when disk reads are unreliable on the device. */
  base64?: string;
};

type SignupFaceSavePayload = { embedding: number[]; data: ArrayBuffer };

export type SignupScreenProps =
  | {
      variant?: "email";
      onGoLogin: () => void;
      onSignupSuccessNoSession: (email: string) => void;
    }
  | {
      variant: "oauthProfile";
      session: Session;
      onComplete: () => void;
    };

export function SignupScreen(props: SignupScreenProps) {
  const isEmail = props.variant !== "oauthProfile";
  const oauthSession = !isEmail ? props.session : null;
  const insets = useSafeAreaInsets();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const [oauthBootstrapping, setOauthBootstrapping] = useState(!isEmail);
  const [oauthProfileMissing, setOauthProfileMissing] = useState(false);

  useEffect(() => {
    if (isEmail || !oauthSession) {
      setOauthBootstrapping(false);
      setOauthProfileMissing(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = getSupabase();
      const sess = oauthSession;
      const userId = sess.user.id;
      const meta = (sess.user.user_metadata ?? {}) as Record<string, unknown>;
      const nameHint = String(meta.full_name ?? meta.name ?? "");
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, mobile_phone, role")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      setOauthProfileMissing(!profile);
      setFullName(String(profile?.full_name ?? nameHint ?? ""));
      setMobile(String(profile?.mobile_phone ?? ""));
      setRole(((profile?.role as UserRole) ?? "student") as UserRole);
      setEmail(sess.user.email ?? "");
      setOauthBootstrapping(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isEmail, oauthSession?.user.id]);

  const webBase = getPalApiBaseUrl();
  const apiOk = Boolean(webBase);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [faceCaptures, setFaceCaptures] = useState<SignupFaceCapture[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [faceBusy, setFaceBusy] = useState(false);
  const [lastFaceError, setLastFaceError] = useState<string | null>(null);

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    email?: string;
    mobile?: string;
    password?: string;
  }>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const isStudent = role === "student";
  const faceReady = faceCaptures.length >= FACE_REGISTRATION_MIN_PHOTOS;
  const canAddFace = faceCaptures.length < FACE_REGISTRATION_MAX_PHOTOS;

  const removeCapture = useCallback((index: number) => {
    setFaceCaptures((prev) => prev.filter((_, i) => i !== index));
  }, []);

  async function handleGoogleSignup() {
    setError("");
    setOauthLoading(true);
    const supabase = getSupabase();
    const result = await signInWithGoogleOAuth(supabase);
    setOauthLoading(false);
    if (result.ok) return;
    if ("cancelled" in result && result.cancelled) return;
    if ("error" in result) setError(result.error);
  }

  async function onFaceCaptured({ uri, base64 }: FaceCaptureResult) {
    setCameraOpen(false);
    setFaceBusy(true);
    setLastFaceError(null);
    try {
      const token = oauthSession?.access_token;
      const embRes = token
        ? await postFaceEmbedding(token, uri)
        : await postFaceEmbeddingForSignup(uri);
      if (!embRes.ok) {
        setLastFaceError(embRes.error);
        Alert.alert("Face processing", embRes.error);
        return;
      }
      const newEmbedding = embRes.embedding;
      let rejectSimilarity = false;
      setFaceCaptures((prev) => {
        if (prev.length > 0) {
          const bestSim = Math.max(
            ...prev.map((c) => cosineSimilarity(newEmbedding, c.embedding))
          );
          if (bestSim < FACE_REGISTRATION_MATCH_THRESHOLD) {
            rejectSimilarity = true;
            return prev;
          }
        }
        return [...prev, { uri, embedding: newEmbedding, base64 }];
      });
      if (rejectSimilarity) {
        const msg =
          "This photo does not match your earlier captures. Retake with only your face visible.";
        setLastFaceError(msg);
        Alert.alert("No match", msg);
      }
    } finally {
      setFaceBusy(false);
    }
  }

  async function waitForStudentProfileRow(userId: string): Promise<boolean> {
    const supabase = getSupabase();
    for (let attempt = 0; attempt < 20; attempt++) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", userId)
        .maybeSingle();
      if (!error && data?.role === "student") return true;
      await new Promise((r) => setTimeout(r, 150));
    }
    return false;
  }

  /** Upload snapshots + embeddings. Blobs must be read before navigation (immediate session unmounts Signup on Android). */
  async function saveStudentFacesAfterSignup(userId: string, payloads: SignupFaceSavePayload[]) {
    const supabase = getSupabase();
    if (payloads.length === 0) {
      Alert.alert(
        "Face photos not saved",
        "Could not read your captured photos from this device. After signing in, the app will prompt you to finish face registration."
      );
      return;
    }

    const profileReady = await waitForStudentProfileRow(userId);
    if (!profileReady) {
      console.error("Signup face save: profile row not ready for student RLS");
      Alert.alert(
        "Face registration pending",
        "Your account was created but the profile was not ready in time. After signing in, the app will prompt you to finish face registration."
      );
      return;
    }

    let savedCount = 0;
    const expected = payloads.length;
    const timestamp = Date.now();
    for (let i = 0; i < payloads.length; i++) {
      const cap = payloads[i]!;
      // Use unique timestamp for each file to avoid collisions
      const filename = `${userId}/${timestamp}-${i}.jpg`;
      try {
        console.log(`Signup face save: uploading ${filename} (size: ${cap.data.byteLength} bytes)`);
        const { error: uploadErr } = await uploadBufferToStorage(
          "face-photos",
          filename,
          cap.data,
          "image/jpeg"
        );
        if (uploadErr) {
          console.error("Signup face upload error:", uploadErr);
          continue;
        }
        console.log(`Signup face saved: ${filename}`);

        const { error: dbErr } = await supabase.from("face_embeddings").insert({
          student_id: userId,
          photo_path: filename,
          embedding: cap.embedding,
        });
        if (dbErr) {
          console.error("Signup face_embeddings insert error:", dbErr.message);
          await supabase.storage.from("face-photos").remove([filename]);
          continue;
        }
        console.log(`Signup face embedding saved for: ${filename}`);
        savedCount++;
      } catch (e) {
        console.error("Signup face save exception:", e);
      }
    }

    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ face_registered: savedCount >= FACE_REGISTRATION_MIN_PHOTOS })
      .eq("id", userId);
    if (profileErr) {
      console.error("Signup face_registered profile update error:", profileErr.message);
    }

    if (savedCount >= FACE_REGISTRATION_MIN_PHOTOS) {
      return;
    }
    if (savedCount > 0) {
      Alert.alert(
        "Face registration incomplete",
        `Only ${savedCount} of ${expected} photos were saved. After signing in, you can add the rest in face registration.`
      );
    } else if (expected > 0) {
      Alert.alert(
        "Face photos not saved",
        "Your account was created but the photos could not be uploaded. After signing in, the app will prompt you to finish face registration."
      );
    }
  }

  async function handleOAuthProfileComplete() {
    if (!oauthSession) return;
    setSubmitAttempted(true);
    setError("");

    const trimmedName = fullName.trim();
    const next: typeof fieldErrors = {};
    if (!trimmedName) next.fullName = "Full name is required.";
    const mobileErr = mobileFieldError(mobile);
    if (mobileErr) next.mobile = mobileErr;

    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    if (isStudent && !faceReady) {
      setError(
        `Please capture at least ${FACE_REGISTRATION_MIN_PHOTOS} face photos before continuing.`
      );
      return;
    }

    if (isStudent && !apiOk) {
      setError(
        "Set EXPO_PUBLIC_PAL_API_URL so this device can reach your face API (same host as your Next.js server, reachable from the phone)."
      );
      return;
    }

    const userEmail = oauthSession.user.email;
    if (!userEmail) {
      setError("Could not read account email from session. Please sign in again.");
      return;
    }

    const normalizedMobile = normalizeTenDigitMobile(mobile)!;
    setLoading(true);

    let studentFacePayloads: SignupFaceSavePayload[] | null = null;
    if (isStudent) {
      const snapshots: SignupFaceSavePayload[] = [];
      for (const cap of faceCaptures) {
        try {
          const data = await arrayBufferFromLocalUri(cap.uri, { base64: cap.base64 });
          snapshots.push({ embedding: cap.embedding, data });
        } catch (e) {
          console.error("OAuth profile: failed to read face capture from disk:", e);
        }
      }
      if (snapshots.length < FACE_REGISTRATION_MIN_PHOTOS) {
        setError(
          "Could not read your face photos from this device. Recapture them and try again."
        );
        if (mounted.current) setLoading(false);
        return;
      }
      studentFacePayloads = snapshots;
    }

    const supabase = getSupabase();
    const userId = oauthSession.user.id;
    const { error: upErr } = await supabase.from("profiles").upsert(
      {
        id: userId,
        email: userEmail,
        full_name: trimmedName,
        mobile_phone: normalizedMobile,
        role,
      },
      { onConflict: "id" }
    );

    if (upErr) {
      const msg = upErr.message ?? "";
      if (/row-level security|violates row-level security/i.test(msg)) {
        setError(
          "Profile save blocked by database policy. Apply supabase/add-profiles-self-insert-policy.sql in Supabase, then try again."
        );
      } else {
        setError(msg);
      }
      if (mounted.current) setLoading(false);
      return;
    }

    if (isStudent && studentFacePayloads) {
      await saveStudentFacesAfterSignup(userId, studentFacePayloads);
    }

    if (mounted.current) setLoading(false);
    if (props.variant === "oauthProfile") props.onComplete();
  }

  async function handleSignup() {
    if (!isEmail) return;
    setSubmitAttempted(true);
    setError("");

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const next: typeof fieldErrors = {};
    if (!trimmedName) next.fullName = "Full name is required.";
    if (!trimmedEmail) next.email = "Email is required.";
    const mobileErr = mobileFieldError(mobile);
    if (mobileErr) next.mobile = mobileErr;
    if (!password) next.password = "Password is required.";
    else if (password.length < 6) next.password = "Password must be at least 6 characters.";

    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    if (isStudent && !faceReady) {
      setError(
        `Please capture at least ${FACE_REGISTRATION_MIN_PHOTOS} face photos before signing up.`
      );
      return;
    }

    if (isStudent && !apiOk) {
      setError(
        "Set EXPO_PUBLIC_PAL_API_URL so this device can reach your face API during signup (same host as your Next.js server, reachable from the phone)."
      );
      return;
    }

    const normalizedMobile = normalizeTenDigitMobile(mobile)!;
    setLoading(true);

    // Read camera files before signUp: immediate session causes navigation away from this
    // screen and on Android cache URIs can become unreadable mid-save.
    let studentFacePayloads: SignupFaceSavePayload[] | null = null;
    if (isStudent) {
      const snapshots: SignupFaceSavePayload[] = [];
      for (const cap of faceCaptures) {
        try {
          const data = await arrayBufferFromLocalUri(cap.uri, { base64: cap.base64 });
          console.log(`Signup face captured: uri=${cap.uri}, size=${data.byteLength} bytes, has base64=${!!cap.base64}`);
          if (data.byteLength < 100) {
            console.warn("Signup face buffer is suspiciously small:", data.byteLength);
          }
          snapshots.push({ embedding: cap.embedding, data });
        } catch (e) {
          console.error("Signup: failed to read face capture from disk:", e);
        }
      }
      if (snapshots.length < FACE_REGISTRATION_MIN_PHOTOS) {
        setError(
          "Could not read your face photos from this device. Recapture them and try signing up again."
        );
        if (mounted.current) setLoading(false);
        return;
      }
      studentFacePayloads = snapshots;
    }

    const supabase = getSupabase();
    const { data, error: signupError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          full_name: trimmedName,
          role,
          mobile_phone: normalizedMobile,
        },
      },
    });

    if (signupError) {
      const msg = signupError.message.toLowerCase();
      if (
        msg.includes("duplicate") ||
        msg.includes("unique") ||
        msg.includes("already registered")
      ) {
        setError(
          "This email or mobile may already be in use. Try signing in, or use a different mobile number."
        );
      } else {
        setError(signupError.message);
      }
      if (mounted.current) setLoading(false);
      return;
    }

    const userId = data.user?.id;
    const session = data.session;

    if (isStudent && userId && session && studentFacePayloads) {
      await saveStudentFacesAfterSignup(userId, studentFacePayloads);
    } else if (isStudent && userId && studentFacePayloads && !session && mounted.current) {
      Alert.alert(
        "Confirm your email",
        "After you confirm your email and sign in, the app will guide you through face registration."
      );
    }

    if (mounted.current) setLoading(false);

    if (!session) {
      props.onSignupSuccessNoSession(trimmedEmail);
    }
  }

  const pwStrength = password.length >= 12 ? 3 : password.length >= 8 ? 2 : password.length >= 6 ? 1 : 0;

  if (!isEmail && oauthBootstrapping) {
    return (
      <View style={[styles.flex, styles.oauthLoadingRoot, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.oauthLoadingText}>Loading your account…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={["rgba(79, 70, 229, 0.92)", "#5b52f0", theme.primaryDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: 20 + insets.top }]}
        >
          {!isEmail ? (
            <View style={styles.heroTopRow}>
              <NucleusWordmark size="sm" inverse />
              <Pressable
                onPress={() => void getSupabase().auth.signOut()}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
              >
                <Text style={styles.heroSignOut}>Sign out</Text>
              </Pressable>
            </View>
          ) : (
            <NucleusWordmark size="sm" inverse />
          )}
          <Text style={[styles.heroTitle, !isEmail && styles.heroTitleTight]}>
            {isEmail ? "Join The Nucleus" : "Finish setup"}
          </Text>
          <Text style={styles.heroBody}>
            {isEmail
              ? "Create an account to manage your campus calendar."
              : "Use the same steps as email sign-up: your details and face photos (for students)."}
          </Text>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{isEmail ? "Create your account" : "Your profile"}</Text>
          <Text style={styles.cardSub}>
            {isEmail
              ? "Sign up with Google or email."
              : "Signed in with Google — complete the fields below."}
          </Text>

          {isEmail ? (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.googleBtn,
                  pressed && styles.googleBtnPressed,
                  (loading || oauthLoading) && styles.googleBtnDisabled,
                ]}
                onPress={() => void handleGoogleSignup()}
                disabled={loading || oauthLoading}
              >
                {oauthLoading ? (
                  <ActivityIndicator color={theme.foreground} />
                ) : (
                  <>
                    <GoogleLogo size={20} />
                    <Text style={styles.googleBtnText}>Continue with Google</Text>
                  </>
                )}
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or sign up with email</Text>
                <View style={styles.dividerLine} />
              </View>
            </>
          ) : null}

          {!isEmail && oauthProfileMissing ? (
            <View style={styles.profileMissingNotice}>
              <Text style={styles.profileMissingText}>
                We could not find your profile row yet. Saving will create it.
              </Text>
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>Personal info</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={[styles.input, fieldErrors.fullName ? styles.inputErr : null]}
              placeholder="John Doe"
              placeholderTextColor={theme.mutedForeground}
              value={fullName}
              onChangeText={(t) => {
                setFullName(t);
                if (submitAttempted) {
                  setFieldErrors((f) => ({
                    ...f,
                    fullName: t.trim() ? undefined : "Full name is required.",
                  }));
                }
              }}
              autoComplete="name"
              editable={!loading && !oauthLoading && (isEmail || !oauthBootstrapping)}
            />
            {fieldErrors.fullName ? <Text style={styles.fieldErr}>{fieldErrors.fullName}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            {isEmail ? (
              <TextInput
                style={[styles.input, fieldErrors.email ? styles.inputErr : null]}
                placeholder="you@university.edu"
                placeholderTextColor={theme.mutedForeground}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (submitAttempted) {
                    setFieldErrors((f) => ({
                      ...f,
                      email: t.trim() ? undefined : "Email is required.",
                    }));
                  }
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!loading && !oauthLoading}
              />
            ) : (
              <Text style={[styles.input, styles.inputReadonly]} selectable>
                {email || "—"}
              </Text>
            )}
            {fieldErrors.email ? <Text style={styles.fieldErr}>{fieldErrors.email}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mobile number</Text>
            <TextInput
              style={[styles.input, fieldErrors.mobile ? styles.inputErr : null]}
              placeholder="10-digit number"
              placeholderTextColor={theme.mutedForeground}
              value={mobile}
              onChangeText={(t) => {
                setMobile(t);
                if (submitAttempted) {
                  setFieldErrors((f) => ({ ...f, mobile: mobileFieldError(t) }));
                }
              }}
              keyboardType="phone-pad"
              maxLength={14}
              autoComplete="tel"
              editable={!loading && !oauthLoading && (isEmail || !oauthBootstrapping)}
            />
            <Text style={styles.hint}>
              10-digit Indian mobile. Used for campus services (e.g. parcel matching).
            </Text>
            {fieldErrors.mobile ? <Text style={styles.fieldErr}>{fieldErrors.mobile}</Text> : null}
          </View>

          {isEmail ? (
            <>
              <Text style={[styles.sectionLabel, styles.sectionSpaced]}>Account setup</Text>

              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={[styles.input, fieldErrors.password ? styles.inputErr : null]}
                  placeholder="Min 6 characters"
                  placeholderTextColor={theme.mutedForeground}
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    if (submitAttempted) {
                      setFieldErrors((f) => ({
                        ...f,
                        password: !t
                          ? "Password is required."
                          : t.length < 6
                            ? "Password must be at least 6 characters."
                            : undefined,
                      }));
                    }
                  }}
                  secureTextEntry
                  autoComplete="new-password"
                  editable={!loading && !oauthLoading}
                />
                <View style={styles.strengthRow}>
                  <View style={[styles.strengthSeg, pwStrength >= 1 && styles.strengthOn]} />
                  <View style={[styles.strengthSeg, pwStrength >= 2 && styles.strengthOn]} />
                  <View style={[styles.strengthSeg, pwStrength >= 3 && styles.strengthOn]} />
                </View>
                {fieldErrors.password ? <Text style={styles.fieldErr}>{fieldErrors.password}</Text> : null}
              </View>
            </>
          ) : null}

          <Text style={[styles.label, !isEmail && { marginTop: 4 }]}>I am a</Text>
          <View style={styles.roleRow}>
            {ROLE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setRole(opt.value)}
                disabled={loading || oauthLoading || (!isEmail && oauthBootstrapping)}
                style={[styles.roleChip, role === opt.value && styles.roleChipOn]}
              >
                <Text style={[styles.roleChipText, role === opt.value && styles.roleChipTextOn]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {isStudent ? (
            <>
              <Text style={[styles.sectionLabel, styles.sectionSpaced]}>Face registration</Text>
              <Text style={styles.faceIntro}>
                Take {FACE_REGISTRATION_MIN_PHOTOS}–{FACE_REGISTRATION_MAX_PHOTOS} clear photos from slightly
                different angles (required for students).
              </Text>
              {!apiOk ? (
                <Text style={styles.warnInline}>
                  Set EXPO_PUBLIC_PAL_API_URL to your backend base URL (where /api/face runs) so photos can be
                  processed on this device.
                </Text>
              ) : null}

              {faceCaptures.length > 0 ? (
                <View style={styles.thumbRow}>
                  {faceCaptures.map((c, i) => (
                    <View key={`${c.uri}-${i}`} style={styles.thumbWrap}>
                      <Image source={{ uri: c.uri }} style={styles.thumbImg} />
                      <Pressable style={styles.thumbRemove} onPress={() => removeCapture(i)} hitSlop={8}>
                        <Text style={styles.thumbRemoveText}>×</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={styles.faceProgress}>
                {faceCaptures.length}/{FACE_REGISTRATION_MIN_PHOTOS} required photos
                {faceCaptures.length < FACE_REGISTRATION_MIN_PHOTOS
                  ? ` — ${FACE_REGISTRATION_MIN_PHOTOS - faceCaptures.length} more needed`
                  : ""}
              </Text>

              {lastFaceError ? <Text style={styles.faceErr}>{lastFaceError}</Text> : null}

              {faceBusy ? (
                <View style={styles.faceBusyRow}>
                  <ActivityIndicator color={theme.primary} />
                  <Text style={styles.muted}>Processing photo…</Text>
                </View>
              ) : canAddFace ? (
                <Pressable
                  style={[styles.outlineBtn, !apiOk && styles.outlineBtnDisabled]}
                  onPress={() => apiOk && setCameraOpen(true)}
                  disabled={
                    !apiOk || loading || oauthLoading || (!isEmail && oauthBootstrapping)
                  }
                >
                  <Text style={styles.outlineBtnText}>
                    {faceCaptures.length === 0
                      ? "Open camera — capture photo 1"
                      : `Add photo ${faceCaptures.length + 1}`}
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {error ? (
            <Text style={styles.bannerErr} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              (loading ||
                oauthLoading ||
                (isStudent && !faceReady) ||
                (!isEmail && oauthBootstrapping)) &&
                styles.primaryBtnDisabled,
              pressed && styles.primaryBtnPressed,
            ]}
            onPress={() => void (isEmail ? handleSignup() : handleOAuthProfileComplete())}
            disabled={
              loading ||
              oauthLoading ||
              (isStudent && !faceReady) ||
              (!isEmail && oauthBootstrapping)
            }
          >
            {loading ? (
              <ActivityIndicator color={theme.primaryForeground} />
            ) : (
              <Text style={styles.primaryBtnText}>
                {isStudent && !faceReady
                  ? `Capture ${FACE_REGISTRATION_MIN_PHOTOS - faceCaptures.length} more photo${
                      FACE_REGISTRATION_MIN_PHOTOS - faceCaptures.length === 1 ? "" : "s"
                    }`
                  : isEmail
                    ? "Sign up"
                    : "Continue"}
              </Text>
            )}
          </Pressable>

          {isEmail ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.footerMuted}>
                Already have an account?{" "}
                <Text style={styles.linkInline} onPress={props.onGoLogin}>
                  Sign in
                </Text>
              </Text>
              {webBase ? (
                <Text style={[styles.footerMuted, { marginTop: 10 }]}>
                  Prefer the browser?{" "}
                  <Text
                    style={styles.linkInline}
                    onPress={async () => {
                      const url = `${webBase}/signup`;
                      if (await Linking.canOpenURL(url)) await Linking.openURL(url);
                    }}
                  >
                    Open web signup
                  </Text>
                </Text>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>

      <FaceCameraModal
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        title={`Photo ${faceCaptures.length + 1} — center your face`}
        onCapture={onFaceCaptured}
      />
    </KeyboardAvoidingView>
  );
}

export function SignupSuccessScreen({
  email,
  onGoLogin,
}: {
  email: string;
  onGoLogin: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.successRoot, { paddingTop: 24 + insets.top, paddingBottom: 24 + insets.bottom }]}>
      <NucleusWordmark size="lg" />
      <Text style={styles.successTitle}>Check your email</Text>
      <Text style={styles.successBody}>
        We&apos;ve sent a confirmation link to <Text style={styles.successEmail}>{email}</Text>. Open it
        to activate your account, then sign in here.
      </Text>
      <Pressable style={styles.primaryBtn} onPress={onGoLogin}>
        <Text style={styles.primaryBtnText}>Back to sign in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.background },
  oauthLoadingRoot: { flex: 1, justifyContent: "center", alignItems: "center" },
  oauthLoadingText: { marginTop: 12, fontSize: 15, color: theme.mutedForeground },
  scroll: { flexGrow: 1 },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  heroSignOut: { fontSize: 15, fontWeight: "600", color: "rgba(255,255,255,0.95)" },
  heroTitle: {
    marginTop: 20,
    fontSize: 22,
    fontWeight: "600",
    color: "#fff",
    lineHeight: 28,
  },
  heroTitleTight: { marginTop: 14 },
  heroBody: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.88)",
    maxWidth: 340,
  },
  card: {
    marginHorizontal: 20,
    marginTop: -16,
    marginBottom: 24,
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 22,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontSize: 22, fontWeight: "600", color: theme.foreground },
  cardSub: { marginTop: 6, fontSize: 15, color: theme.mutedForeground },
  profileMissingNotice: {
    marginTop: 14,
    marginBottom: 4,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.5)",
    backgroundColor: "rgba(254, 252, 232, 0.95)",
  },
  profileMissingText: { fontSize: 13, color: "#854d0e", lineHeight: 18 },
  inputReadonly: {
    color: theme.mutedForeground,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
  },
  googleBtn: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    minHeight: 48,
  },
  googleBtnPressed: { opacity: 0.92 },
  googleBtnDisabled: { opacity: 0.65 },
  googleBtnText: { fontSize: 16, fontWeight: "600", color: theme.foreground },
  dividerRow: {
    marginTop: 18,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.border },
  dividerText: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: theme.mutedForeground,
    textTransform: "uppercase",
  },
  sectionLabel: {
    marginTop: 20,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: theme.mutedForeground,
  },
  sectionSpaced: { marginTop: 28, paddingTop: 20, borderTopWidth: 1, borderTopColor: theme.border },
  field: { marginTop: 14 },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.foreground,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 16,
    color: theme.foreground,
    backgroundColor: theme.card,
  },
  inputErr: { borderColor: theme.destructive },
  fieldErr: { marginTop: 4, fontSize: 13, color: theme.destructive },
  hint: { marginTop: 6, fontSize: 12, color: theme.mutedForeground, lineHeight: 17 },
  strengthRow: { flexDirection: "row", gap: 4, marginTop: 8 },
  strengthSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.border,
  },
  strengthOn: { backgroundColor: theme.primary },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  roleChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  roleChipOn: {
    borderColor: theme.primary,
    backgroundColor: "rgba(79, 70, 229, 0.1)",
  },
  roleChipText: { fontSize: 14, fontWeight: "600", color: theme.foreground },
  roleChipTextOn: { color: theme.primary },
  faceIntro: { marginTop: 8, fontSize: 13, color: theme.mutedForeground, lineHeight: 19 },
  warnInline: {
    marginTop: 10,
    fontSize: 13,
    color: "#92400e",
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    padding: 10,
    borderRadius: 8,
  },
  thumbRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  thumbWrap: { position: "relative" },
  thumbImg: { width: 72, height: 72, borderRadius: 8, backgroundColor: theme.border },
  thumbRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.destructive,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbRemoveText: { color: "#fff", fontSize: 16, fontWeight: "700", lineHeight: 18 },
  faceProgress: { marginTop: 10, fontSize: 13, color: theme.mutedForeground },
  faceErr: { marginTop: 8, fontSize: 13, color: theme.destructive },
  faceBusyRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  muted: { fontSize: 13, color: theme.mutedForeground },
  outlineBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  outlineBtnDisabled: { opacity: 0.45 },
  outlineBtnText: { fontSize: 15, fontWeight: "600", color: theme.primary },
  bannerErr: { marginTop: 14, fontSize: 14, color: theme.destructive },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: theme.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  primaryBtnDisabled: { opacity: 0.55 },
  primaryBtnPressed: { opacity: 0.9 },
  primaryBtnText: {
    color: theme.primaryForeground,
    fontSize: 16,
    fontWeight: "600",
  },
  divider: {
    marginTop: 28,
    paddingTop: 28,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  footerMuted: {
    textAlign: "center",
    fontSize: 14,
    color: theme.mutedForeground,
    lineHeight: 20,
  },
  linkInline: { fontWeight: "600", color: theme.primary },
  successRoot: {
    flex: 1,
    backgroundColor: theme.background,
    paddingHorizontal: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  successTitle: {
    marginTop: 24,
    fontSize: 22,
    fontWeight: "700",
    color: theme.foreground,
    textAlign: "center",
  },
  successBody: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: theme.mutedForeground,
    textAlign: "center",
  },
  successEmail: { fontWeight: "700", color: theme.foreground },
});
