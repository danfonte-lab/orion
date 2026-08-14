// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<
  string,
  ComponentProps<typeof MaterialIcons>["name"]
>;
// IconSymbolName depends on MAPPING which is declared below — declare it after
// MAPPING to avoid using an identifier before it's defined.

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */

const MAPPING = {
  house: "house",
  "house.fill": "house",
  "person.2": "groups",
  "person.2.fill": "groups",
  person: "person",
  lock: "lock",
  "paperplane.fill": "send",
  calendar: "calendar-month",
  "doc.text": "description",
  "doc.text.fill": "description",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  eye: "visibility",
  "eye.slash": "visibility-off",
  bell: "notifications-none",
  "newspaper.fill": "newspaper",
  touchid: "fingerprint",
} as IconMapping;

type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return (
    <MaterialIcons
      color={color}
      size={size}
      name={MAPPING[name]}
      style={style}
    />
  );
}
