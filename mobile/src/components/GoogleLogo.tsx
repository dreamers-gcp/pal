import { Image, type ImageStyle, type StyleProp } from "react-native";

/** Official multicolor “G” (same asset family as web Sign in with Google). */
const source = require("../../assets/google-g-logo.png");

export function GoogleLogo({ size = 20 }: { size?: number }) {
  const style: StyleProp<ImageStyle> = { width: size, height: size };
  return (
    <Image
      source={source}
      style={style}
      resizeMode="contain"
      accessible={false}
    />
  );
}
