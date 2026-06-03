import { Dimensions, PixelRatio, Platform } from 'react-native';

const GUIDELINE_BASE_WIDTH = 375;
const GUIDELINE_BASE_HEIGHT = 812;

const getWindowDimensions = () => {
  const { width, height } = Dimensions.get('window');
  return {
    width: width || 375,
    height: height || 812
  };
};

export const scale = (size) => {
  const { width } = getWindowDimensions();
  return (width / GUIDELINE_BASE_WIDTH) * size;
};

export const verticalScale = (size) => {
  const { height } = getWindowDimensions();
  return (height / GUIDELINE_BASE_HEIGHT) * size;
};

export const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;

export const fs = (size) => {
  const newSize = scale(size);
  const roundedSize = PixelRatio.roundToNearestPixel(newSize);
  const finalSize = Platform.OS === 'ios' ? roundedSize : roundedSize - 1;
  return finalSize > 0 ? finalSize : size;
};

export const fontScale = fs;
export const responsiveFontSize = fs;

export const spacing = {
  get xs() { return scale(4); },
  get sm() { return scale(8); },
  get md() { return scale(12); },
  get lg() { return scale(16); },
  get xl() { return scale(24); },
  get xxl() { return scale(32); },
};

export const wp = (percent) => {
  const { width } = getWindowDimensions();
  return (width * percent) / 100;
};

export const hp = (percent) => {
  const { height } = getWindowDimensions();
  return (height * percent) / 100;
};

export const isSmallDevice = getWindowDimensions().width < 340;
export const isMediumDevice = getWindowDimensions().width >= 340 && getWindowDimensions().width < 400;
export const isLargeDevice = getWindowDimensions().width >= 400;

const responsive = {
  wp,
  hp,
  scale,
  verticalScale,
  moderateScale,
  fs,
  fontScale,
  responsiveFontSize,
  spacing,
  isSmallDevice,
  isMediumDevice,
  isLargeDevice,
  get SCREEN_WIDTH() { return getWindowDimensions().width; },
  get SCREEN_HEIGHT() { return getWindowDimensions().height; }
};

export default responsive;
