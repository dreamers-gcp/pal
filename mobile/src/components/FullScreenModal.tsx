import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Block swipe dismiss (e.g. loading). */
  dismissDisabled?: boolean;
};

/**
 * Full-screen overlay with top drag handle: pull down to dismiss (plus Android back via onRequestClose).
 * pageY + measureInWindow + move-capture so inner ScrollViews don't steal downward drags from the top region.
 */
export function FullScreenModal({ visible, onClose, children, dismissDisabled = false }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(0)).current;
  const dismissDisabledRef = useRef(dismissDisabled);
  const onCloseRef = useRef(onClose);
  const pullStartRef = useRef(0);
  const pullCurrentRef = useRef(0);
  const touchStartPageYRef = useRef<number | null>(null);
  /** Finger must start at or below this screen Y (px) to drag-dismiss (handle strip + a bit of body). */
  const dragZoneBottomPageYRef = useRef(Number.POSITIVE_INFINITY);
  const handleStripRef = useRef<View>(null);

  /** Extra px below measured handle strip bottom that still counts as "top" for dismiss. */
  const extraBelowHandlePx = 100;

  useEffect(() => {
    dismissDisabledRef.current = dismissDisabled;
  }, [dismissDisabled]);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const syncDragZone = useCallback(() => {
    handleStripRef.current?.measureInWindow((_, y, __, h) => {
      dragZoneBottomPageYRef.current = y + h + extraBelowHandlePx;
    });
  }, []);

  useEffect(() => {
    if (!visible) {
      dragZoneBottomPageYRef.current = Number.POSITIVE_INFINITY;
      return;
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => syncDragZone());
    });
    return () => cancelAnimationFrame(id);
  }, [visible, syncDragZone]);

  const animateDismiss = useCallback(() => {
    const h = Dimensions.get("window").height;
    Animated.timing(translateY, {
      toValue: h,
      duration: 280,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        translateY.setValue(0);
        onCloseRef.current();
      }
    });
  }, [translateY]);

  const clearTouchStart = useCallback(() => {
    touchStartPageYRef.current = null;
  }, []);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: (evt) => {
          touchStartPageYRef.current = evt.nativeEvent.pageY;
          return false;
        },
        onMoveShouldSetPanResponderCapture: (evt, g) => {
          if (dismissDisabledRef.current) return false;
          if (g.dy < 8) return false;
          if (g.dy < Math.abs(g.dx) * 0.82) return false;
          let startPageY = touchStartPageYRef.current;
          if (startPageY == null) {
            startPageY = evt.nativeEvent.pageY - g.dy;
            touchStartPageYRef.current = startPageY;
          }
          const limit = dragZoneBottomPageYRef.current;
          if (!Number.isFinite(limit)) return false;
          return startPageY <= limit + 8;
        },
        onMoveShouldSetPanResponder: (evt, g) => {
          if (dismissDisabledRef.current) return false;
          if (g.dy < 8) return false;
          if (g.dy < Math.abs(g.dx) * 0.82) return false;
          let startPageY = touchStartPageYRef.current;
          if (startPageY == null) {
            startPageY = evt.nativeEvent.pageY - g.dy;
            touchStartPageYRef.current = startPageY;
          }
          const limit = dragZoneBottomPageYRef.current;
          if (!Number.isFinite(limit)) return false;
          return startPageY <= limit + 8;
        },
        onPanResponderGrant: () => {
          translateY.stopAnimation((v) => {
            pullStartRef.current = v;
            pullCurrentRef.current = v;
          });
        },
        onPanResponderMove: (_, g) => {
          const next = Math.max(0, pullStartRef.current + g.dy);
          pullCurrentRef.current = next;
          translateY.setValue(next);
        },
        onPanResponderRelease: (_, g) => {
          clearTouchStart();
          if (dismissDisabledRef.current) {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              damping: 24,
              stiffness: 280,
            }).start();
            return;
          }
          const y = pullCurrentRef.current;
          const h = Dimensions.get("window").height;
          const threshold = Math.min(420, h * 0.28);
          if (y > threshold || g.vy > 0.3) {
            animateDismiss();
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              damping: 24,
              stiffness: 280,
            }).start();
          }
        },
        onPanResponderTerminate: clearTouchStart,
        onPanResponderTerminationRequest: () => false,
      }),
    [translateY, animateDismiss, clearTouchStart]
  );

  useEffect(() => {
    if (visible) translateY.setValue(0);
  }, [visible, translateY]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => {
        if (!dismissDisabledRef.current) onCloseRef.current();
      }}
    >
      <Animated.View
        {...pan.panHandlers}
        collapsable={false}
        onLayout={syncDragZone}
        style={[styles.root, { transform: [{ translateY }] }]}
        accessibilityRole="none"
      >
        <View
          ref={handleStripRef}
          style={[styles.handleStrip, { paddingTop: Math.max(10, insets.top) }]}
          accessibilityLabel="Drag down to close"
          accessibilityRole="adjustable"
          onLayout={syncDragZone}
        >
          <View style={styles.pill} />
        </View>
        <View style={styles.body}>{children}</View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  handleStrip: {
    paddingBottom: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    backgroundColor: theme.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  pill: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.border,
  },
  body: { flex: 1, minHeight: 0 },
});
