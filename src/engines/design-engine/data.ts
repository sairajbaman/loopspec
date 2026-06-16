export interface Palette {
  name: string;
  industry: string[];
  keywords: string[];
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  text: string;
  muted: string;
  border: string;
}

export interface FontPairing {
  name: string;
  keywords: string[];
  heading: string;
  body: string;
  mono?: string;
}

export interface UIStyle {
  name: string;
  keywords: string[];
  description: string;
  cssProperties: Record<string, string>;
  antiPatterns: string[];
}

// ─── WCAG Contrast Validation ────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function validatePaletteContrast(p: Palette): { textOnBg: number; mutedOnBg: number; passesAA: boolean; passesAAA: boolean } {
  const textOnBg = contrastRatio(p.text, p.bg);
  const mutedOnBg = contrastRatio(p.muted, p.bg);
  return { textOnBg, mutedOnBg, passesAA: textOnBg >= 4.5, passesAAA: textOnBg >= 7 };
}

// ─── 42 Palettes ─────────────────────────────────────────────────────────────

export const PALETTES: Palette[] = [
  { name: 'Ocean Blue', industry: ['fintech', 'saas'], keywords: ['professional', 'trust', 'corporate'], primary: '#0066FF', secondary: '#1A1A2E', accent: '#00C9A7', bg: '#FAFBFC', text: '#0F172A', muted: '#64748B', border: '#E2E8F0' },
  { name: 'Midnight Finance', industry: ['fintech', 'crypto'], keywords: ['dark', 'premium', 'modern'], primary: '#6366F1', secondary: '#0F172A', accent: '#22D3EE', bg: '#020617', text: '#F1F5F9', muted: '#94A3B8', border: '#1E293B' },
  { name: 'Emerald Trust', industry: ['fintech', 'banking'], keywords: ['stable', 'growth', 'wealth'], primary: '#059669', secondary: '#064E3B', accent: '#FCD34D', bg: '#FFFFFF', text: '#111827', muted: '#6B7280', border: '#D1D5DB' },
  { name: 'Teal Health', industry: ['healthcare'], keywords: ['calm', 'clean', 'medical'], primary: '#0D9488', secondary: '#134E4A', accent: '#06B6D4', bg: '#F0FDFA', text: '#0F172A', muted: '#64748B', border: '#CCFBF1' },
  { name: 'Healing Blue', industry: ['healthcare', 'wellness'], keywords: ['trust', 'serene', 'professional'], primary: '#2563EB', secondary: '#1E3A5F', accent: '#10B981', bg: '#F8FAFC', text: '#1E293B', muted: '#64748B', border: '#E2E8F0' },
  { name: 'Warm Wellness', industry: ['healthcare', 'beauty'], keywords: ['soft', 'natural', 'organic'], primary: '#D97706', secondary: '#78350F', accent: '#059669', bg: '#FFFBEB', text: '#1C1917', muted: '#78716C', border: '#FED7AA' },
  { name: 'Sunset Commerce', industry: ['ecommerce'], keywords: ['vibrant', 'energy', 'bold'], primary: '#EA580C', secondary: '#1E293B', accent: '#FBBF24', bg: '#FFFFFF', text: '#0F172A', muted: '#64748B', border: '#FED7AA' },
  { name: 'Luxury Black', industry: ['ecommerce', 'fashion'], keywords: ['luxury', 'premium', 'elegant', 'dark'], primary: '#A78BFA', secondary: '#0F0F0F', accent: '#F59E0B', bg: '#0A0A0A', text: '#FAFAFA', muted: '#A1A1AA', border: '#27272A' },
  { name: 'Fresh Market', industry: ['ecommerce', 'food'], keywords: ['fresh', 'natural', 'organic'], primary: '#16A34A', secondary: '#14532D', accent: '#FB923C', bg: '#F0FDF4', text: '#1A2E1A', muted: '#6B7280', border: '#BBF7D0' },
  { name: 'Royal Purple', industry: ['education', 'creative'], keywords: ['creative', 'inspired', 'learning'], primary: '#7C3AED', secondary: '#1E1B4B', accent: '#F472B6', bg: '#FAF5FF', text: '#1E1B4B', muted: '#6B7280', border: '#E9D5FF' },
  { name: 'Scholar Blue', industry: ['education'], keywords: ['academic', 'serious', 'knowledge'], primary: '#1D4ED8', secondary: '#1E3A5F', accent: '#F59E0B', bg: '#F8FAFC', text: '#111827', muted: '#6B7280', border: '#BFDBFE' },
  { name: 'Indigo SaaS', industry: ['saas', 'startup'], keywords: ['modern', 'clean', 'tech'], primary: '#4F46E5', secondary: '#1E1B4B', accent: '#06B6D4', bg: '#FFFFFF', text: '#111827', muted: '#6B7280', border: '#E5E7EB' },
  { name: 'Minimal SaaS', industry: ['saas', 'productivity'], keywords: ['minimal', 'clean', 'focused'], primary: '#18181B', secondary: '#27272A', accent: '#3B82F6', bg: '#FFFFFF', text: '#09090B', muted: '#71717A', border: '#E4E4E7' },
  { name: 'Gradient SaaS', industry: ['saas', 'ai'], keywords: ['ai', 'futuristic', 'gradient'], primary: '#8B5CF6', secondary: '#EC4899', accent: '#06B6D4', bg: '#0F0F23', text: '#F8FAFC', muted: '#94A3B8', border: '#1E293B' },
  { name: 'Coral Social', industry: ['social'], keywords: ['fun', 'warm', 'engaging'], primary: '#F43F5E', secondary: '#1E293B', accent: '#8B5CF6', bg: '#FFFFFF', text: '#0F172A', muted: '#64748B', border: '#FFE4E6' },
  { name: 'Neon Social', industry: ['social', 'gaming'], keywords: ['bold', 'energetic', 'young'], primary: '#EC4899', secondary: '#0F172A', accent: '#22D3EE', bg: '#020617', text: '#F1F5F9', muted: '#94A3B8', border: '#1E293B' },
  { name: 'Forest Green', industry: ['sustainability', 'nature'], keywords: ['natural', 'eco', 'earth'], primary: '#15803D', secondary: '#14532D', accent: '#CA8A04', bg: '#F0FDF4', text: '#1A2E1A', muted: '#6B7280', border: '#86EFAC' },
  { name: 'Warm Neutral', industry: ['portfolio', 'agency'], keywords: ['warm', 'neutral', 'sophisticated'], primary: '#92400E', secondary: '#1C1917', accent: '#D97706', bg: '#FAFAF9', text: '#1C1917', muted: '#78716C', border: '#E7E5E4' },
  { name: 'Ice Cold', industry: ['saas', 'analytics'], keywords: ['data', 'analytical', 'cold'], primary: '#0EA5E9', secondary: '#0C4A6E', accent: '#10B981', bg: '#F0F9FF', text: '#0F172A', muted: '#64748B', border: '#BAE6FD' },
  { name: 'Monochrome', industry: ['portfolio', 'blog'], keywords: ['minimal', 'monochrome', 'simple'], primary: '#171717', secondary: '#404040', accent: '#737373', bg: '#FFFFFF', text: '#171717', muted: '#737373', border: '#E5E5E5' },
  { name: 'Sunset Warm', industry: ['travel', 'lifestyle'], keywords: ['warm', 'travel', 'adventure'], primary: '#DC2626', secondary: '#7C2D12', accent: '#F59E0B', bg: '#FFF7ED', text: '#1C1917', muted: '#78716C', border: '#FDBA74' },
  { name: 'Deep Space', industry: ['gaming', 'tech'], keywords: ['dark', 'space', 'gaming'], primary: '#8B5CF6', secondary: '#020617', accent: '#22D3EE', bg: '#030712', text: '#E2E8F0', muted: '#64748B', border: '#1E293B' },
  { name: 'Candy Pop', industry: ['kids', 'entertainment'], keywords: ['playful', 'colorful', 'fun'], primary: '#EC4899', secondary: '#7C3AED', accent: '#F59E0B', bg: '#FDF4FF', text: '#1E1B4B', muted: '#6B7280', border: '#F5D0FE' },
  { name: 'Legal Navy', industry: ['legal', 'consulting'], keywords: ['serious', 'authority', 'formal'], primary: '#1E40AF', secondary: '#172554', accent: '#B45309', bg: '#FFFFFF', text: '#111827', muted: '#4B5563', border: '#D1D5DB' },
  { name: 'Real Estate', industry: ['real-estate', 'property'], keywords: ['premium', 'property', 'home'], primary: '#0F766E', secondary: '#134E4A', accent: '#D97706', bg: '#FFFFFF', text: '#1E293B', muted: '#64748B', border: '#E2E8F0' },
  { name: 'Fitness Energy', industry: ['fitness', 'sports'], keywords: ['energy', 'active', 'sport'], primary: '#DC2626', secondary: '#18181B', accent: '#EAB308', bg: '#FFFFFF', text: '#18181B', muted: '#71717A', border: '#E4E4E7' },
  { name: 'Restaurant Warm', industry: ['food', 'restaurant'], keywords: ['warm', 'appetite', 'cozy'], primary: '#B91C1C', secondary: '#1C1917', accent: '#CA8A04', bg: '#FFFBEB', text: '#1C1917', muted: '#78716C', border: '#FDE68A' },
  { name: 'Music Dark', industry: ['music', 'entertainment'], keywords: ['dark', 'creative', 'bold'], primary: '#A855F7', secondary: '#09090B', accent: '#F43F5E', bg: '#0A0A0A', text: '#FAFAFA', muted: '#A1A1AA', border: '#27272A' },
  { name: 'Startup Fresh', industry: ['startup', 'saas'], keywords: ['fresh', 'startup', 'launch'], primary: '#2563EB', secondary: '#1E40AF', accent: '#10B981', bg: '#FFFFFF', text: '#111827', muted: '#6B7280', border: '#E5E7EB' },
  { name: 'Charity Soft', industry: ['nonprofit', 'charity'], keywords: ['soft', 'caring', 'community'], primary: '#0891B2', secondary: '#164E63', accent: '#F97316', bg: '#ECFEFF', text: '#1E293B', muted: '#64748B', border: '#A5F3FC' },
  { name: 'Crypto Dark', industry: ['crypto', 'web3'], keywords: ['crypto', 'web3', 'blockchain'], primary: '#F59E0B', secondary: '#0F172A', accent: '#8B5CF6', bg: '#020617', text: '#F1F5F9', muted: '#94A3B8', border: '#1E293B' },
  // NEW palettes (32-42)
  { name: 'AI Gradient', industry: ['ai', 'saas'], keywords: ['ai', 'machine-learning', 'intelligent', 'neural'], primary: '#7C3AED', secondary: '#2563EB', accent: '#06B6D4', bg: '#0B1120', text: '#F0F4F8', muted: '#8B9DC3', border: '#1E2D4A' },
  { name: 'Zen Spa', industry: ['beauty', 'wellness'], keywords: ['spa', 'relaxation', 'zen', 'beauty'], primary: '#BE8C63', secondary: '#2C1810', accent: '#7C9A6C', bg: '#FDF8F4', text: '#2C1810', muted: '#8B7355', border: '#E8DDD4' },
  { name: 'Developer Dark', industry: ['developer', 'tech'], keywords: ['developer', 'terminal', 'hacker', 'code'], primary: '#22C55E', secondary: '#0D1117', accent: '#F97316', bg: '#0D1117', text: '#C9D1D9', muted: '#8B949E', border: '#30363D' },
  { name: 'Pastel Dream', industry: ['lifestyle', 'beauty'], keywords: ['pastel', 'dreamy', 'gentle', 'feminine'], primary: '#F0ABFC', secondary: '#A78BFA', accent: '#67E8F9', bg: '#FEFCE8', text: '#3F3F46', muted: '#71717A', border: '#FDE68A' },
  { name: 'Maritime Blue', industry: ['logistics', 'travel'], keywords: ['marine', 'ocean', 'shipping', 'nautical'], primary: '#0369A1', secondary: '#0C4A6E', accent: '#F97316', bg: '#F0F9FF', text: '#0C4A6E', muted: '#64748B', border: '#BAE6FD' },
  { name: 'Government', industry: ['government', 'civic'], keywords: ['government', 'civic', 'public', 'official'], primary: '#1E3A5F', secondary: '#0F172A', accent: '#B91C1C', bg: '#FFFFFF', text: '#111827', muted: '#4B5563', border: '#D1D5DB' },
  { name: 'Terracotta Earth', industry: ['architecture', 'interior'], keywords: ['earthy', 'terracotta', 'interior', 'architecture'], primary: '#C2410C', secondary: '#431407', accent: '#059669', bg: '#FFFAF5', text: '#292524', muted: '#78716C', border: '#E7E5E4' },
  { name: 'Electric Violet', industry: ['events', 'entertainment'], keywords: ['party', 'event', 'nightlife', 'electric'], primary: '#A21CAF', secondary: '#0F172A', accent: '#FBBF24', bg: '#0A0A0A', text: '#F5F5F5', muted: '#A3A3A3', border: '#262626' },
  { name: 'Mint Fresh', industry: ['health', 'fintech'], keywords: ['mint', 'fresh', 'clean', 'crisp'], primary: '#0D9488', secondary: '#115E59', accent: '#6366F1', bg: '#F0FDFA', text: '#134E4A', muted: '#5F9EA0', border: '#99F6E4' },
  { name: 'Slate Professional', industry: ['consulting', 'enterprise'], keywords: ['slate', 'professional', 'enterprise', 'b2b'], primary: '#475569', secondary: '#1E293B', accent: '#0EA5E9', bg: '#F8FAFC', text: '#0F172A', muted: '#64748B', border: '#CBD5E1' },
  { name: 'Rose Gold', industry: ['beauty', 'jewelry'], keywords: ['rose-gold', 'feminine', 'luxury', 'jewelry'], primary: '#BE185D', secondary: '#500724', accent: '#D4A574', bg: '#FFF1F2', text: '#1C1917', muted: '#78716C', border: '#FECDD3' },
];


// ─── 28 Font Pairings ────────────────────────────────────────────────────────

export const FONT_PAIRINGS: FontPairing[] = [
  { name: 'Professional Clean', keywords: ['professional', 'clean', 'corporate', 'saas'], heading: 'Inter', body: 'Inter', mono: 'JetBrains Mono' },
  { name: 'Modern Geometric', keywords: ['modern', 'tech', 'geometric', 'startup'], heading: 'Space Grotesk', body: 'DM Sans', mono: 'Fira Code' },
  { name: 'Elegant Serif', keywords: ['elegant', 'luxury', 'premium', 'fashion'], heading: 'Playfair Display', body: 'Source Sans 3' },
  { name: 'Friendly Round', keywords: ['friendly', 'playful', 'casual', 'fun'], heading: 'Poppins', body: 'Nunito' },
  { name: 'Bold Statement', keywords: ['bold', 'strong', 'impact', 'sport'], heading: 'Montserrat', body: 'Open Sans' },
  { name: 'Classic Editorial', keywords: ['editorial', 'blog', 'magazine', 'reading'], heading: 'Lora', body: 'Source Serif 4' },
  { name: 'Minimal Swiss', keywords: ['minimal', 'swiss', 'clean', 'simple'], heading: 'Helvetica Neue', body: 'Helvetica Neue' },
  { name: 'Tech Forward', keywords: ['tech', 'code', 'developer', 'hacker'], heading: 'JetBrains Mono', body: 'Inter', mono: 'JetBrains Mono' },
  { name: 'Soft Humanist', keywords: ['soft', 'human', 'healthcare', 'wellness'], heading: 'Outfit', body: 'DM Sans' },
  { name: 'Sharp Geometric', keywords: ['sharp', 'angular', 'fintech', 'data'], heading: 'Plus Jakarta Sans', body: 'Inter' },
  { name: 'Warm Approachable', keywords: ['warm', 'approachable', 'community', 'social'], heading: 'Lexend', body: 'Nunito Sans' },
  { name: 'Dense Information', keywords: ['dashboard', 'data', 'dense', 'analytics'], heading: 'IBM Plex Sans', body: 'IBM Plex Sans', mono: 'IBM Plex Mono' },
  { name: 'Luxury Display', keywords: ['luxury', 'display', 'fashion', 'premium'], heading: 'Cormorant Garamond', body: 'Raleway' },
  { name: 'Startup Velocity', keywords: ['startup', 'speed', 'energy', 'growth'], heading: 'Manrope', body: 'Figtree' },
  { name: 'Creative Expressive', keywords: ['creative', 'art', 'design', 'portfolio'], heading: 'Sora', body: 'Work Sans' },
  { name: 'Academic Serious', keywords: ['academic', 'research', 'formal', 'education'], heading: 'Merriweather', body: 'Source Sans 3' },
  { name: 'Futuristic Mono', keywords: ['futuristic', 'ai', 'sci-fi', 'cyber'], heading: 'Orbitron', body: 'Rajdhani', mono: 'Space Mono' },
  { name: 'Friendly Education', keywords: ['education', 'kids', 'learning', 'school'], heading: 'Quicksand', body: 'Nunito' },
  { name: 'Corporate Neutral', keywords: ['corporate', 'enterprise', 'neutral', 'business'], heading: 'Roboto', body: 'Roboto', mono: 'Roboto Mono' },
  { name: 'Modern Readable', keywords: ['readable', 'content', 'blog', 'article'], heading: 'Geist', body: 'Geist', mono: 'Geist Mono' },
  { name: 'Elegant Modern', keywords: ['elegant', 'modern', 'refined'], heading: 'DM Serif Display', body: 'DM Sans' },
  // NEW fonts (22-28)
  { name: 'Architectural', keywords: ['architecture', 'interior', 'space', 'structure'], heading: 'Archivo', body: 'Karla' },
  { name: 'News Editorial', keywords: ['news', 'journalism', 'media', 'press'], heading: 'Fraunces', body: 'Commissioner' },
  { name: 'Playful Kids', keywords: ['kids', 'playful', 'fun', 'colorful'], heading: 'Baloo 2', body: 'Quicksand' },
  { name: 'Cinematic', keywords: ['cinema', 'film', 'dramatic', 'theater'], heading: 'Bebas Neue', body: 'Lato' },
  { name: 'Calm Wellness', keywords: ['calm', 'meditation', 'yoga', 'mindful'], heading: 'Tenor Sans', body: 'Questrial' },
  { name: 'Data Heavy', keywords: ['table', 'spreadsheet', 'numbers', 'finance'], heading: 'Albert Sans', body: 'Albert Sans', mono: 'Source Code Pro' },
  { name: 'Japanese Minimal', keywords: ['japanese', 'zen', 'wabi-sabi', 'minimal'], heading: 'Zen Kaku Gothic New', body: 'Noto Sans JP' },
];

// ─── 22 UI Styles ────────────────────────────────────────────────────────────

export const UI_STYLES: UIStyle[] = [
  { name: 'Glassmorphism', keywords: ['glass', 'glassmorphism', 'frosted', 'blur'], description: 'Frosted glass with blur and transparency', cssProperties: { 'backdrop-filter': 'blur(16px)', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }, antiPatterns: ['Don\'t use low opacity on light backgrounds', 'Avoid too many stacked glass layers'] },
  { name: 'Neubrutalism', keywords: ['neubrutalism', 'brutalist', 'bold', 'chunky'], description: 'Bold borders, thick shadows, raw aesthetic', cssProperties: { border: '3px solid #000', 'box-shadow': '4px 4px 0px #000', 'border-radius': '0' }, antiPatterns: ['Don\'t use subtle colors', 'Avoid rounded corners'] },
  { name: 'Minimal Flat', keywords: ['minimal', 'flat', 'clean', 'simple'], description: 'No shadows, subtle borders, lots of whitespace', cssProperties: { 'box-shadow': 'none', border: '1px solid #e5e7eb', 'border-radius': '8px' }, antiPatterns: ['Don\'t use gradients', 'Don\'t use heavy shadows'] },
  { name: 'Soft UI / Neumorphism', keywords: ['neumorphism', 'soft', 'embossed'], description: 'Soft raised/pressed elements with inner shadows', cssProperties: { 'box-shadow': '8px 8px 16px #d1d5db, -8px -8px 16px #ffffff', 'border-radius': '16px' }, antiPatterns: ['Terrible for accessibility', 'Don\'t use on dark backgrounds'] },
  { name: 'Dark Mode Premium', keywords: ['dark', 'premium', 'night', 'midnight'], description: 'Rich dark backgrounds with accent glows', cssProperties: { background: '#0F172A', color: '#F1F5F9', 'box-shadow': '0 0 20px rgba(99,102,241,0.15)' }, antiPatterns: ['Don\'t use pure black #000', 'Don\'t use pure white text on dark'] },
  { name: 'Gradient Mesh', keywords: ['gradient', 'mesh', 'aurora', 'colorful'], description: 'Multi-color gradient backgrounds', cssProperties: { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }, antiPatterns: ['Don\'t use harsh contrasting gradients', 'Ensure text contrast over gradients'] },
  { name: 'Material Design 3', keywords: ['material', 'google', 'android'], description: 'Google Material 3 with dynamic color', cssProperties: { 'border-radius': '16px', 'box-shadow': '0 1px 3px rgba(0,0,0,0.12)' }, antiPatterns: ['Don\'t mix with iOS-style blur', 'Don\'t use sharp corners'] },
  { name: 'Apple HIG', keywords: ['apple', 'ios', 'macos', 'cupertino'], description: 'Apple Human Interface Guidelines inspired', cssProperties: { 'backdrop-filter': 'blur(20px)', 'border-radius': '12px', 'box-shadow': '0 2px 8px rgba(0,0,0,0.08)' }, antiPatterns: ['Don\'t use heavy borders', 'Don\'t use small tap targets'] },
  { name: 'Corporate Clean', keywords: ['corporate', 'enterprise', 'business', 'formal'], description: 'Professional, understated, accessible', cssProperties: { 'border-radius': '4px', 'box-shadow': '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid #d1d5db' }, antiPatterns: ['Don\'t use playful colors', 'Don\'t use rounded buttons'] },
  { name: 'Retro Pixel', keywords: ['retro', 'pixel', '8-bit', 'nostalgic'], description: 'Pixelated borders, monospace fonts, retro palette', cssProperties: { 'border-radius': '0', border: '2px solid', 'font-family': 'monospace', 'image-rendering': 'pixelated' }, antiPatterns: ['Don\'t use smooth gradients', 'Don\'t use modern sans-serif'] },
  { name: 'Organic Natural', keywords: ['organic', 'natural', 'handmade', 'earthy'], description: 'Warm tones, irregular shapes, natural textures', cssProperties: { 'border-radius': '24px 4px 24px 4px' }, antiPatterns: ['Don\'t use sharp geometric shapes', 'Don\'t use neon colors'] },
  { name: 'Bento Grid', keywords: ['bento', 'grid', 'dashboard', 'cards'], description: 'Multi-size card grid layout', cssProperties: { display: 'grid', gap: '16px', 'border-radius': '16px' }, antiPatterns: ['Don\'t use too many different sizes', 'Don\'t skip responsive breakpoints'] },
  { name: 'Claymorphism', keywords: ['clay', 'claymorphism', '3d', 'soft'], description: '3D-looking soft inflated elements', cssProperties: { 'border-radius': '32px', 'box-shadow': '8px 8px 16px rgba(0,0,0,0.1), inset -4px -4px 8px rgba(0,0,0,0.05), inset 4px 4px 8px rgba(255,255,255,0.8)' }, antiPatterns: ['Don\'t flatten the 3D effect', 'Don\'t use on text-heavy layouts'] },
  { name: 'Line Art', keywords: ['line', 'outline', 'wireframe', 'thin'], description: 'Thin lines, outlined icons, minimal fill', cssProperties: { border: '1px solid currentColor', background: 'transparent', 'stroke-width': '1.5' }, antiPatterns: ['Don\'t use heavy fills', 'Don\'t use thick borders'] },
  { name: 'Aurora Glow', keywords: ['aurora', 'glow', 'neon', 'cyberpunk'], description: 'Glowing elements on dark background', cssProperties: { 'box-shadow': '0 0 20px rgba(139,92,246,0.5), 0 0 40px rgba(139,92,246,0.2)', background: '#0a0a0a' }, antiPatterns: ['Don\'t use on light backgrounds', 'Don\'t overuse glow effects'] },
  { name: 'Swiss Minimalism', keywords: ['swiss', 'typography', 'grid', 'helvetica'], description: 'Grid-based, type-driven, maximum clarity', cssProperties: { 'letter-spacing': '-0.02em', 'line-height': '1.5' }, antiPatterns: ['Don\'t use decorative elements', 'Don\'t use more than 2 font weights'] },
  // NEW styles (17-22)
  { name: 'Frosted Card', keywords: ['frosted', 'card', 'layered', 'depth'], description: 'Semi-transparent cards with depth layers', cssProperties: { background: 'rgba(255,255,255,0.7)', 'backdrop-filter': 'blur(10px)', 'border-radius': '12px', border: '1px solid rgba(0,0,0,0.05)', 'box-shadow': '0 4px 24px rgba(0,0,0,0.06)' }, antiPatterns: ['Don\'t use on busy backgrounds', 'Test contrast for text readability'] },
  { name: 'Brutalist Type', keywords: ['brutalist', 'type', 'oversized', 'experimental'], description: 'Oversized type, asymmetric layout, intentional tension', cssProperties: { 'font-size': 'clamp(3rem, 8vw, 8rem)', 'font-weight': '900', 'letter-spacing': '-0.04em', 'line-height': '0.9' }, antiPatterns: ['Don\'t use for body text', 'Don\'t use more than one oversized element per view'] },
  { name: 'Outlined Modern', keywords: ['outlined', 'border', 'modern', 'clean'], description: 'Outlined elements with no fill, modern and airy', cssProperties: { background: 'transparent', border: '2px solid currentColor', 'border-radius': '8px', color: 'inherit' }, antiPatterns: ['Don\'t mix with filled buttons', 'Needs sufficient border contrast'] },
  { name: 'Grain Texture', keywords: ['grain', 'texture', 'vintage', 'film'], description: 'Subtle grain overlay for analog warmth', cssProperties: { 'background-image': 'url("data:image/svg+xml,...")', 'mix-blend-mode': 'overlay', opacity: '0.4' }, antiPatterns: ['Don\'t make grain too visible', 'Ensure text remains crisp over grain'] },
  { name: 'Scroll Reveal', keywords: ['scroll', 'reveal', 'animation', 'cinematic'], description: 'Content reveals on scroll with staggered animations', cssProperties: { opacity: '0', transform: 'translateY(20px)', transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }, antiPatterns: ['Respect prefers-reduced-motion', 'Don\'t delay critical content'] },
  { name: 'Micro Interaction', keywords: ['micro', 'interaction', 'feedback', 'tactile'], description: 'Rich micro-interactions on every touch point', cssProperties: { transition: 'transform 150ms ease, box-shadow 150ms ease', cursor: 'pointer' }, antiPatterns: ['Don\'t animate on load', 'Keep animations under 300ms'] },
];
