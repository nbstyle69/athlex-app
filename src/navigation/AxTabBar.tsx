import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../context/ThemeContext';
import { AxCounterBadge, AxGlass } from '../components/ax';
import { axTypography } from '../theme/axTokens';
import { TAB_BAR, tabBarFootprint, useKeyboardShown } from './tabBarLayout';

/** Barre d'onglets flottante en verre de l'athlète. */
export function AxTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { theme } = useTheme();
  const ax = theme.ax;
  const { width } = useWindowDimensions();
  const keyboardShown = useKeyboardShown();
  const onHeightChange = React.useContext(BottomTabBarHeightCallbackContext);
  const footprint = tabBarFootprint(insets.bottom);

  React.useEffect(() => {
    onHeightChange?.(footprint);
  }, [onHeightChange, footprint]);

  const focusedOptions = descriptors[state.routes[state.index].key].options;
  const hiddenByScreen = (StyleSheet.flatten(focusedOptions.tabBarStyle) as { display?: string } | undefined)?.display === 'none';
  if (hiddenByScreen || (focusedOptions.tabBarHideOnKeyboard && keyboardShown)) return null;

  return (
    <View
      testID="ax-tab-bar"
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          width: width - TAB_BAR.sideMargin * 2,
          left: TAB_BAR.sideMargin,
          bottom: insets.bottom + TAB_BAR.bottomGap,
          borderColor: ax.border,
        },
      ]}
    >
      <AxGlass color={ax.background} opacity={TAB_BAR.glassOpacity} radius={TAB_BAR.radius} testID="ax-tab-bar-glass" />
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const color = focused ? ax.accentText : ax.textMuted;
        const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title ?? route.name;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.dispatch({ ...CommonActions.navigate(route), target: state.key });
          }
        };
        const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });
        const badge = options.tabBarBadge;
        return (
          <Pressable
            key={route.key}
            testID={options.tabBarButtonTestID ?? `tab-${route.name}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.item}
          >
            <View>
              {options.tabBarIcon?.({ focused, color, size: TAB_BAR.iconSize })}
              {badge !== undefined && (
                <View style={styles.badge}>
                  <AxCounterBadge count={Number(badge)} testID={`tab-${route.name}-badge`} />
                </View>
              )}
            </View>
            <Text style={[axTypography.tab, { color }]} numberOfLines={1}>{label}</Text>
            <View
              testID={`tab-${route.name}-dot`}
              style={[styles.dot, { backgroundColor: ax.accentText, opacity: focused ? 1 : 0 }]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    height: TAB_BAR.height,
    borderRadius: TAB_BAR.radius,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: TAB_BAR.paddingVertical,
    paddingHorizontal: TAB_BAR.paddingHorizontal,
    overflow: 'hidden',
  },
  item: {
    minWidth: TAB_BAR.minTouch,
    minHeight: TAB_BAR.minTouch,
    alignItems: 'center',
    gap: TAB_BAR.itemGap,
  },
  badge: { position: 'absolute', top: -6, left: TAB_BAR.iconSize - 6 },
  dot: { width: TAB_BAR.dotSize, height: TAB_BAR.dotSize, borderRadius: TAB_BAR.dotSize / 2 },
});
