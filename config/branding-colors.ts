type BrandingColors = Record<string, unknown> | null;

const HEX_COLOR = /^#[\da-f]{6}$/i;

const contrastText = (color: string) => {
  const channels = [1, 3, 5].map((index) => {
    const value = parseInt(color.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.179 ? "#111827" : "#ffffff";
};

export function getBrandColors(branding: BrandingColors) {
  const primary =
    typeof branding?.primaryColor === "string" &&
    HEX_COLOR.test(branding.primaryColor)
      ? branding.primaryColor
      : "#2563eb";
  const secondary =
    typeof branding?.secondaryColor === "string" &&
    HEX_COLOR.test(branding.secondaryColor)
      ? branding.secondaryColor
      : "#0F4C81";

  return {
    primary,
    secondary,
    onPrimary: contrastText(primary),
    onSecondary: contrastText(secondary),
  };
}
