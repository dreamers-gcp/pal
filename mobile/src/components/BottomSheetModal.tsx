import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";

export type BottomSheetModalProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Block swipe and backdrop dismiss (e.g. while saving). */
  dismissDisabled?: boolean;
  maxHeight?: ViewStyle["maxHeight"];
  sheetStyle?: StyleProp<ViewStyle>;
};

/**
 * Standard bottom sheet: drag handle + swipe down to dismiss, backdrop tap, Android back.
 * Uses pageY + measureInWindow + move-capture so ScrollView inside doesn't eat the gesture
 * when the drag starts in the top "grip" region.
 */
export function BottomSheetModal({
  visible,
  onClose,
  children,
  dismissDisabled = false,
  maxHeight = "92%",
  sheetStyle,
}: BottomSheetModalProps) {
  const insets = useSafeAreaInsets();
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const dismissDisabledRef = useRef(dismissDisabled);
  const onCloseRef = useRef(onClose);
  const sheetPullStartYRef = useRef(0);
  const sheetPullCurrentYRef = useRef(0);
  /** Screen Y where finger went down (set in capture). */
  const touchStartPageYRef = useRef<number | null>(null);
  /** Top edge of sheet in window coords (from measureInWindow). */
  const sheetTopPageYRef = useRef(Number.POSITIVE_INFINITY);
  const sheetRef = useRef<View>(null);

  const syncSheetTop = useCallback(() => {
    sheetRef.current?.measureInWindow((_, y) => {
      sheetTopPageYRef.current = y;
    });
  }, []);

  useEffect(() => {
    dismissDisabledRef.current = dismissDisabled;
  }, [dismissDisabled]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!visible) {
      sheetTopPageYRef.current = Number.POSITIVE_INFINITY;
      return;
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => syncSheetTop());
    });
    return () => cancelAnimationFrame(id);
  }, [visible, syncSheetTop]);

  const animateDismiss = useCallback(() => {
    const h = Dimensions.get("window").height;
    Animated.timing(sheetTranslateY, {
      toValue: h,
      duration: 260,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        sheetTranslateY.setValue(0);
        onCloseRef.current();
      }
    });
  }, [sheetTranslateY]);

  const finishClose = useCallback(() => {
    if (dismissDisabledRef.current) return;
    sheetTranslateY.stopAnimation();
    sheetTranslateY.setValue(0);
    onCloseRef.current();
  }, [sheetTranslateY]);

  const clearTouchStart = useCallback(() => {
    touchStartPageYRef.current = null;
  }, []);

  const sheetPanResponder = useMemo(
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
          const top = sheetTopPageYRef.current;
          if (!Number.isFinite(top)) return false;
          const topDragZone = 120;
          return startPageY >= top - 4 && startPageY <= top + topDragZone;
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
          const top = sheetTopPageYRef.current;
          if (!Number.isFinite(top)) return false;
          const topDragZone = 120;
          return startPageY >= top - 4 && startPageY <= top + topDragZone;
        },
        onPanResponderGrant: () => {
          sheetTranslateY.stopAnimation((v) => {
            sheetPullStartYRef.current = v;
            sheetPullCurrentYRef.current = v;
          });
        },
        onPanResponderMove: (_, g) => {
          const next = Math.max(0, sheetPullStartYRef.current + g.dy);
          sheetPullCurrentYRef.current = next;
          sheetTranslateY.setValue(next);
        },
        onPanResponderRelease: (_, g) => {
          clearTouchStart();
          if (dismissDisabledRef.current) {
            Animated.spring(sheetTranslateY, {
              toValue: 0,
              useNativeDriver: true,
              damping: 24,
              stiffness: 280,
            }).start();
            return;
          }
          const y = sheetPullCurrentYRef.current;
          const h = Dimensions.get("window").height;
          const threshold = Math.min(380, h * 0.32);
          if (y > threshold || g.vy > 0.3) {
            animateDismiss();
          } else {
            Animated.spring(sheetTranslateY, {
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
    [sheetTranslateY, animateDismiss, clearTouchStart]
  );

  useEffect(() => {
    if (visible) {
      sheetTranslateY.setValue(0);
    }
  }, [visible, sheetTranslateY]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={finishClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={finishClose} accessibilityLabel="Dismiss" />
        <Animated.View
          ref={sheetRef}
          {...sheetPanResponder.panHandlers}
          collapsable={false}
          onLayout={syncSheetTop}
          style={[
            styles.modalSheet,
            {
              maxHeight,
              paddingBottom: Math.max(12, insets.bottom + 8),
              transform: [{ translateY: sheetTranslateY }],
            },
            sheetStyle,
          ]}
          accessibilityLabel="Bottom sheet"
          accessibilityRole="none"
        >
          <View style={styles.sheetHandleArea} accessibilityLabel="Drag down to close" accessibilityRole="adjustable">
            <View style={styles.sheetHandlePill} />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 12, 28, 0.45)",
  },
  modalSheet: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 4,
    borderTopWidth: 1,
    borderColor: theme.border,
  },
  sheetHandleArea: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    marginBottom: 4,
    minHeight: 44,
  },
  sheetHandlePill: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.border,
  },
});
