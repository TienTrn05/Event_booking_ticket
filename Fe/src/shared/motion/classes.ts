/** Home micro-interactions; shared timings stay separate from layout utilities. */
export const homeMotion = [
  '[&_.home-cta_svg]:!transition-transform [&_.home-cta_svg]:!duration-300 [&_.home-cta:hover_svg]:!translate-x-1',
  '[&_.home-link_svg]:!transition-transform [&_.home-link_svg]:!duration-300 [&_.home-link:hover_svg]:!translate-x-1',
  '[&_.chapter-locations_button_img]:![transition:scale_700ms_cubic-bezier(0.22,1,0.36,1)] [&_.chapter-locations_button:hover_img]:[scale:1.06]',
  '[&_.chapter-blog_article_img]:![transition:scale_800ms_cubic-bezier(0.22,1,0.36,1)] [&_.chapter-blog_article:hover_img]:[scale:1.035]',
  '[&_.hero-event-preview_img]:![transition:scale_900ms_cubic-bezier(0.22,1,0.36,1)] [&_.hero-event-preview:hover_img]:[scale:1.04]',
  '[&_.section-emblem_svg]:![transition:rotate_450ms_ease] [&_.section-emblem:hover_svg]:[rotate:-12deg]',
  '[&_.resale-ticket-art]:![transition:rotate_500ms_cubic-bezier(0.22,1,0.36,1)] [&_.resale-ticket-art:hover]:[rotate:-6deg]',
  '[&_button:active]:scale-[0.97] [&_a:active]:scale-[0.98]',
  "[&_.favorite-button[aria-pressed='true']_svg]:![animation:menuArrive_260ms_cubic-bezier(0.22,1,0.36,1)]",
].join(' ');
