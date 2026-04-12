import { forwardRef } from "react";
import { RefreshControl, ScrollView, type ScrollViewProps } from "react-native";
import { theme } from "../theme";

export type RefreshableScrollViewProps = Omit<ScrollViewProps, "refreshControl"> & {
  refreshing: boolean;
  onRefresh: () => void | Promise<void>;
};

/** ScrollView with platform pull-to-refresh (matches primary accent). */
export const RefreshableScrollView = forwardRef<ScrollView, RefreshableScrollViewProps>(
  function RefreshableScrollView({ refreshing, onRefresh, children, ...rest }, ref) {
    return (
      <ScrollView
        ref={ref}
        {...rest}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        {children}
      </ScrollView>
    );
  }
);
