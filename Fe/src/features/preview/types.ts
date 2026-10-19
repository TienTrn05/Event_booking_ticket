export type PreviewKind = 'event' | 'product' | 'article' | 'organizer' | 'resale';

export interface PreviewItem {
  kind: PreviewKind;
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  image?: string;
  facts: Array<{ label: string; value: string }>;
  detailPath: string;
}
