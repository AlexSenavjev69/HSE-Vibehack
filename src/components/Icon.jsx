const paths = {
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  user: 'M20 21v-2a7 7 0 0 0-14 0v2M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  plus: 'M12 5v14M5 12h14',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  clock: 'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  back: 'M19 12H5m6-6-6 6 6 6',
  chevron: 'm9 5 7 7-7 7',
  close: 'm6 6 12 12M6 18 18 6',
  check: 'm5 12 4 4L19 6',
  'check-circle': 'm8 12 3 3 5-6M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z',
  bag: 'M5 7h14l2 14H3ZM8 8V6a4 4 0 0 1 8 0v2',
  laptop: 'M4 4h16v12H4ZM2 20h20l-2-4H4Z',
  plant: 'M12 21V10M12 14C4 15 3 10 3 6c6-1 9 3 9 8ZM12 10c0-6 4-8 9-8 0 5-3 9-9 8Z',
  book: 'M12 5v16M12 5C8 2 4 3 2 4v15c4-2 7-1 10 2 3-3 6-4 10-2V4c-3-1-6-2-10 1Z',
  sparkles: 'm12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5ZM21 2v4m-2-2h4',
  bolt: 'm13 2-9 12h7l-1 8 10-13h-8Z',
  message: 'M21 11a9 9 0 0 1-9 9H4l-3 2 2-6a9 9 0 1 1 18-5ZM7 11h.01M12 11h.01M17 11h.01',
  clipboard: 'M9 4H5v18h14V4h-4M9 2h6v5H9ZM8 12h8M8 16h5',
  edit: 'm16 3 5 5M4 16 17 3a2 2 0 0 1 4 4L8 20l-5 1ZM12 21h9',
  shield: 'm12 2 8 3v6c0 6-8 11-8 11S4 17 4 11V5Zm-4 9 3 3 5-6',
  globe: 'M2 12h20M12 2a20 20 0 0 1 0 20 20 20 0 0 1 0-20ZM22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  filter: 'M4 7h16M4 17h16M8 4v6M16 14v6',
  people: 'M16 21v-2a6 6 0 0 0-12 0v2M14 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM17 3a4 4 0 0 1 0 8m2 3a5 5 0 0 1 3 5v2',
}

export default function Icon({ name, size = 22, className = '', ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`icon ${className}`} {...props}><path d={paths[name] || paths.heart} /></svg>
}
