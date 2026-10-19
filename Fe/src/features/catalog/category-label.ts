const labels: Record<string, string> = {
  music: 'Nhạc sống',
  sports: 'Thể thao',
  arts: 'Sân khấu & Nghệ thuật',
  workshops: 'Hội thảo & Workshop',
  festivals: 'Tham quan & Trải nghiệm',
  technology: 'Công nghệ',
  other: 'Khác',
};
export function categoryLabel(name: string, slug?: string, locale = 'vi') {
  if (locale === 'en') return name;
  return labels[(slug ?? name).toLowerCase()] ?? labels[name.toLowerCase()] ?? name;
}
