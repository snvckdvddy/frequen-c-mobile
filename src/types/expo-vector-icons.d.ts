// Type declaration for @expo/vector-icons (bundled inside expo)
declare module '@expo/vector-icons' {
  export { Ionicons } from '@expo/vector-icons/Ionicons';
  export { MaterialCommunityIcons } from '@expo/vector-icons/MaterialCommunityIcons';
  export { FontAwesome } from '@expo/vector-icons/FontAwesome';
}

declare module '@expo/vector-icons/Ionicons' {
  import { ComponentType } from 'react';
  interface IconProps {
    name: string;
    size?: number;
    color?: string;
    style?: any;
  }
  export const Ionicons: ComponentType<IconProps> & { glyphMap: Record<string, number> };
  export default Ionicons;
}
